use std::collections::HashMap;
use crate::models::{BackupBranch, BackupInfo, CommitRewrite, RewritePlan};
use anyhow::{Result, Context};

fn parse_oid(sha: &str) -> Result<gix::ObjectId> {
    sha.parse::<gix::ObjectId>()
        .map_err(|e| anyhow::anyhow!("Invalid SHA {}: {}", sha, e))
}

fn current_timestamp() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
}

fn parse_time(s: &str) -> gix::date::Time {
    if let Some((secs, offset)) = s.split_once(' ') {
        let secs: i64 = secs.parse().unwrap_or(0);
        let offset: i32 = offset.parse().unwrap_or(0);
        gix::date::Time::new(secs, offset)
    } else {
        gix::date::Time::now_local_or_utc()
    }
}

fn build_signature(
    name: &str,
    email: &str,
    orig_sig: Option<gix::actor::SignatureRef<'_>>,
) -> gix::actor::Signature {
    let time = orig_sig
        .map(|s| parse_time(s.time))
        .unwrap_or_else(gix::date::Time::now_local_or_utc);
    gix::actor::Signature {
        name: name.into(),
        email: email.into(),
        time,
    }
}

fn map_ref_err(e: Box<dyn std::error::Error + Send + Sync>) -> anyhow::Error {
    anyhow::anyhow!("{}", e)
}

pub fn create_backup_refs(repo: &gix::Repository) -> Result<String> {
    let ts = current_timestamp();

    for item in repo.references()?.all()? {
        let reference = item.map_err(map_ref_err)?;
        if reference.name().category() == Some(gix::refs::Category::LocalBranch) {
            let name = reference.name().shorten().to_string();
            let target = reference
                .target()
                .try_id()
                .ok_or_else(|| anyhow::anyhow!("Cannot backup detached ref"))?
                .to_owned();
            let backup_name = format!("refs/backup/pre-rewrite/{ts}/{name}");
            repo.reference(backup_name.as_str(), target, gix::refs::transaction::PreviousValue::Any, "")?;
        }
    }

    Ok(format!("refs/backup/pre-rewrite/{ts}"))
}

pub fn apply_rewrite_plan(
    repo: &gix::Repository,
    plan: &RewritePlan,
) -> Result<Vec<CommitRewrite>> {
    let mut actual_rewrites: Vec<CommitRewrite> = Vec::new();
    let mut sha_map: HashMap<String, gix::ObjectId> = HashMap::new();

    for rewrite in &plan.rewrites {
        if !rewrite.is_modified {
            actual_rewrites.push(rewrite.clone());
            continue;
        }

        let old_oid = parse_oid(&rewrite.old_sha)?;
        let orig_commit = repo
            .find_commit(old_oid)
            .with_context(|| format!("Finding commit {}", rewrite.old_sha))?;
        let orig_data = orig_commit
            .decode()
            .with_context(|| format!("Decoding commit {}", rewrite.old_sha))?;

        let tree_id = orig_data.tree();

        let author_sig = build_signature(
            &rewrite.author_name,
            &rewrite.author_email,
            orig_data.author().ok(),
        );

        let committer_sig = build_signature(
            &rewrite.committer_name,
            &rewrite.committer_email,
            orig_data.committer().ok(),
        );

        let parent_ids: Vec<gix::ObjectId> = orig_data
            .parents()
            .map(|p| {
                let hex = p.to_string();
                sha_map.get(&hex).copied().unwrap_or(p)
            })
            .collect();

        let commit = gix::objs::Commit {
            tree: tree_id,
            parents: parent_ids.into(),
            author: author_sig,
            committer: committer_sig,
            encoding: None,
            message: rewrite.message.clone().into(),
            extra_headers: Default::default(),
        };

        let new_id = repo.write_object(&commit)?;
        let new_oid: gix::ObjectId = new_id.into();
        let new_sha = new_oid.to_string();

        sha_map.insert(rewrite.old_sha.clone(), new_oid);

        let mut updated_parents = rewrite.parent_shas.clone();
        for parent in &mut updated_parents {
            if let Some(new_parent) = sha_map.get(parent.as_str()) {
                *parent = new_parent.to_string();
            }
        }

        actual_rewrites.push(CommitRewrite {
            old_sha: rewrite.old_sha.clone(),
            new_sha,
            author_name: rewrite.author_name.clone(),
            author_email: rewrite.author_email.clone(),
            committer_name: rewrite.committer_name.clone(),
            committer_email: rewrite.committer_email.clone(),
            message: rewrite.message.clone(),
            parent_shas: updated_parents,
            is_modified: true,
        });
    }

    update_references(repo, &sha_map).context("Updating references")?;

    Ok(actual_rewrites)
}

fn update_references(
    repo: &gix::Repository,
    sha_map: &HashMap<String, gix::ObjectId>,
) -> Result<()> {
    for item in repo.references()?.all()? {
        let reference = item.map_err(map_ref_err)?;

        if reference.name().category() != Some(gix::refs::Category::LocalBranch) {
            continue;
        }

        let target = reference.target();
        let Some(peeled) = target.try_id() else {
            continue;
        };
        let peeled_hex = peeled.to_hex().to_string();
        if let Some(new_id) = sha_map.get(&peeled_hex) {
            let name = reference.name().to_owned();
            eprintln!("Updating ref {} from {} to {}", name, peeled_hex, new_id);
            repo.reference(name, *new_id, gix::refs::transaction::PreviousValue::Any, "")?;
        }
    }
    Ok(())
}

pub fn rollback(repo: &gix::Repository, backup_prefix: &str) -> Result<()> {
    for item in repo.references()?.all()? {
        let reference = item.map_err(map_ref_err)?;
        let name = reference.name().shorten().to_string();
        let backup_name = format!("{backup_prefix}/{name}");

        if let Ok(backup_ref) = repo.find_reference(backup_name.as_str()) {
            let target = backup_ref
                .target()
                .try_id()
                .ok_or_else(|| anyhow::anyhow!("Invalid backup ref target"))?
                .to_owned();

            let branch_name = format!("refs/heads/{name}");
            repo.reference(branch_name.as_str(), target, gix::refs::transaction::PreviousValue::Any, "")?;
        }
    }
    Ok(())
}

pub fn clear_backups(repo: &gix::Repository, backup_prefix: &str) -> Result<()> {
    let git_dir = repo.git_dir().to_path_buf();
    let backup_path = git_dir.join(backup_prefix);

    if backup_path.exists() {
        std::fs::remove_dir_all(&backup_path)
            .with_context(|| format!("Failed to remove backup directory {:?}", backup_path))?;
    }

    Ok(())
}

pub fn list_backups(repo: &gix::Repository) -> Result<Vec<BackupInfo>> {
    let mut backups: Vec<BackupInfo> = Vec::new();
    let prefix = "refs/backup/pre-rewrite/";

    for item in repo.references()?.all()? {
        let reference = item.map_err(map_ref_err)?;
        let full_name = reference.name().to_string();

        if !full_name.starts_with(prefix) {
            continue;
        }

        let rest = full_name.strip_prefix(prefix).unwrap_or("");
        let parts: Vec<&str> = rest.splitn(2, '/').collect();
        if parts.len() != 2 {
            continue;
        }

        let timestamp = parts[0].to_string();
        let branch_name = parts[1].to_string();

        let sha = reference
            .target()
            .try_id()
            .map(|id| id.to_string())
            .unwrap_or_default();

        let backup_prefix = format!("{prefix}{timestamp}");

        if let Some(backup) = backups.iter_mut().find(|b: &&mut BackupInfo| b.prefix == backup_prefix) {
            backup.branches.push(BackupBranch { name: branch_name, sha });
        } else {
            backups.push(BackupInfo {
                timestamp: timestamp.clone(),
                prefix: backup_prefix,
                branches: vec![BackupBranch { name: branch_name, sha }],
            });
        }
    }

    backups.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(backups)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_temp_repo() -> (tempfile::TempDir, gix::Repository) {
        let dir = tempfile::tempdir().unwrap();
        let repo = gix::init_bare(&dir).unwrap();
        (dir, repo)
    }

    fn sig(name: &str, email: &str) -> gix::actor::Signature {
        gix::actor::Signature {
            name: name.into(),
            email: email.into(),
            time: gix::date::Time::now_local_or_utc(),
        }
    }

    fn make_commit(
        repo: &gix::Repository,
        message: &str,
        author: &gix::actor::Signature,
        parents: Vec<gix::ObjectId>,
    ) -> gix::ObjectId {
        let tree = gix::objs::Tree::empty();
        let tree_id = repo.write_object(&tree).unwrap();

        let commit = gix::objs::Commit {
            tree: tree_id.into(),
            parents: parents.into(),
            author: author.clone(),
            committer: author.clone(),
            encoding: None,
            message: message.into(),
            extra_headers: Default::default(),
        };

        let id = repo.write_object(&commit).unwrap();
        id.into()
    }

    #[test]
    fn test_apply_rewrite_creates_new_commits() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test User", "test@test.com");

        let a = make_commit(&repo, "First", &s, vec![]);
        let b = make_commit(&repo, "Second", &s, vec![a]);

        let plan = RewritePlan {
            rewrites: vec![
                CommitRewrite {
                    old_sha: a.to_string(),
                    new_sha: a.to_string(),
                    author_name: "Test User".to_string(),
                    author_email: "test@test.com".to_string(),
                    committer_name: "Test User".to_string(),
                    committer_email: "test@test.com".to_string(),
                    message: "First".to_string(),
                    parent_shas: vec![],
                    is_modified: false,
                },
                CommitRewrite {
                    old_sha: b.to_string(),
                    new_sha: "placeholder".to_string(),
                    author_name: "Rewritten".to_string(),
                    author_email: "rewritten@test.com".to_string(),
                    committer_name: "Rewritten".to_string(),
                    committer_email: "rewritten@test.com".to_string(),
                    message: "EDITED".to_string(),
                    parent_shas: vec![a.to_string()],
                    is_modified: true,
                },
            ],
            total_affected: 1,
            branches_affected: vec![],
            backup_ref: String::new(),
        };

        let result = apply_rewrite_plan(&repo, &plan).unwrap();

        assert_eq!(result.len(), 2);
        assert!(!result[0].is_modified);
        assert_eq!(result[0].new_sha, a.to_string());

        assert!(result[1].is_modified);
        assert_ne!(result[1].new_sha, b.to_string());
        assert_eq!(result[1].message, "EDITED");
        assert_eq!(result[1].author_name, "Rewritten");

        let new_oid = parse_oid(&result[1].new_sha).unwrap();
        let new_commit = repo.find_commit(new_oid).unwrap();
        let decoded = new_commit.decode().unwrap();
        assert_eq!(decoded.message().title, "EDITED");
    }

    #[test]
    fn test_apply_rewrite_updates_branch_ref() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Author", "author@test.com");

        let a = make_commit(&repo, "First", &s, vec![]);
        repo.reference("refs/heads/main", a, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let plan = RewritePlan {
            rewrites: vec![
                CommitRewrite {
                    old_sha: a.to_string(),
                    new_sha: "ph_new".to_string(),
                    author_name: "Author".to_string(),
                    author_email: "author@test.com".to_string(),
                    committer_name: "Author".to_string(),
                    committer_email: "author@test.com".to_string(),
                    message: "EDITED".to_string(),
                    parent_shas: vec![],
                    is_modified: true,
                },
            ],
            total_affected: 1,
            branches_affected: vec!["main".to_string()],
            backup_ref: String::new(),
        };

        let result = apply_rewrite_plan(&repo, &plan).unwrap();

        assert!(result[0].is_modified);
        assert_ne!(result[0].new_sha, a.to_string());
        assert_eq!(result[0].message, "EDITED");

        let main_ref = repo.find_reference("refs/heads/main").unwrap();
        let main_oid = main_ref.target().try_id().unwrap().to_string();
        assert_eq!(main_oid, result[0].new_sha, "Branch should point to rewritten commit");
    }

    #[test]
    fn test_create_backup_refs() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");
        let oid = make_commit(&repo, "Initial", &s, vec![]);

        repo.reference("refs/heads/main", oid, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let backup_prefix = create_backup_refs(&repo).unwrap();
        assert!(backup_prefix.starts_with("refs/backup/pre-rewrite/"));

        let backup_name = format!("{}/main", backup_prefix);
        let backup_ref = repo.find_reference(backup_name.as_str()).unwrap();
        assert_eq!(
            backup_ref.target().try_id().unwrap().to_string(),
            oid.to_string()
        );
    }

    #[test]
    fn test_rollback_restores_original_refs() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");

        let original_oid = make_commit(&repo, "Original", &s, vec![]);
        repo.reference("refs/heads/main", original_oid, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let backup_prefix = create_backup_refs(&repo).unwrap();

        let new_oid = make_commit(&repo, "New", &s, vec![original_oid]);
        repo.reference("refs/heads/main", new_oid, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();
        assert_ne!(
            repo.find_reference("refs/heads/main").unwrap().target().try_id().unwrap().to_string(),
            original_oid.to_string(),
            "Branch should have changed before rollback"
        );

        rollback(&repo, &backup_prefix).unwrap();

        let main_ref = repo.find_reference("refs/heads/main").unwrap();
        assert_eq!(
            main_ref.target().try_id().unwrap().to_string(),
            original_oid.to_string()
        );
    }

    #[test]
    fn test_backup_refs_not_overwritten_by_rewrite() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");

        let original_oid = make_commit(&repo, "Original", &s, vec![]);
        repo.reference("refs/heads/main", original_oid, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let backup_prefix = create_backup_refs(&repo).unwrap();
        let backup_ref_name = format!("{backup_prefix}/main");

        let backup_oid_before = repo.find_reference(&backup_ref_name)
            .unwrap().target().try_id().unwrap().to_string();
        assert_eq!(backup_oid_before, original_oid.to_string());

        let plan = RewritePlan {
            rewrites: vec![
                CommitRewrite {
                    old_sha: original_oid.to_string(),
                    new_sha: "ph_new".to_string(),
                    author_name: "Test".to_string(),
                    author_email: "test@test.com".to_string(),
                    committer_name: "Test".to_string(),
                    committer_email: "test@test.com".to_string(),
                    message: "EDITED".to_string(),
                    parent_shas: vec![],
                    is_modified: true,
                },
            ],
            total_affected: 1,
            branches_affected: vec!["main".to_string()],
            backup_ref: backup_prefix.clone(),
        };

        let result = apply_rewrite_plan(&repo, &plan).unwrap();

        let backup_oid_after = repo.find_reference(&backup_ref_name)
            .unwrap().target().try_id().unwrap().to_string();
        assert_eq!(backup_oid_after, original_oid.to_string(),
            "Backup ref should still point to original commit, not be overwritten");
        
        let main_oid = repo.find_reference("refs/heads/main")
            .unwrap().target().try_id().unwrap().to_string();
        assert_eq!(main_oid, result[0].new_sha,
            "Branch should point to the rewritten commit");
    }

    #[test]
    fn test_clear_backups() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");
        let oid = make_commit(&repo, "Initial", &s, vec![]);

        repo.reference("refs/heads/main", oid, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let backup_prefix = create_backup_refs(&repo).unwrap();
        let backup_name = format!("{backup_prefix}/main");
        assert!(repo.find_reference(&backup_name).is_ok(), "Backup should exist");

        clear_backups(&repo, &backup_prefix).unwrap();

        assert!(repo.find_reference(&backup_name).is_err(), "Backup should be removed after clear");
        assert!(repo.find_reference("refs/heads/main").is_ok(), "Branch should still exist");
    }

    #[test]
    fn test_list_backups_returns_grouped_backups() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");

        let oid1 = make_commit(&repo, "First", &s, vec![]);
        let oid2 = make_commit(&repo, "Second", &s, vec![oid1]);

        repo.reference("refs/heads/main", oid1, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();
        repo.reference("refs/heads/feature", oid2, gix::refs::transaction::PreviousValue::Any, "")
            .unwrap();

        let backup_prefix = create_backup_refs(&repo).unwrap();

        let backups = list_backups(&repo).unwrap();
        assert_eq!(backups.len(), 1, "Should have one backup group");

        let backup = &backups[0];
        assert_eq!(backup.prefix, backup_prefix);
        assert_eq!(backup.branches.len(), 2, "Should have two branches backed up");

        let branch_names: Vec<&str> = backup.branches.iter().map(|b| b.name.as_str()).collect();
        assert!(branch_names.contains(&"main"));
        assert!(branch_names.contains(&"feature"));
    }

    #[test]
    fn test_rewrite_cascades_to_descendants() {
        let (_dir, repo) = create_temp_repo();
        let s = sig("Test", "test@test.com");

        let a = make_commit(&repo, "A", &s, vec![]);
        let b = make_commit(&repo, "B", &s, vec![a]);
        let c = make_commit(&repo, "C", &s, vec![b]);

        let plan = RewritePlan {
            rewrites: vec![
                CommitRewrite {
                    old_sha: a.to_string(),
                    new_sha: "ph_a".to_string(),
                    author_name: "Test".to_string(),
                    author_email: "test@test.com".to_string(),
                    committer_name: "Test".to_string(),
                    committer_email: "test@test.com".to_string(),
                    message: "A EDITED".to_string(),
                    parent_shas: vec![],
                    is_modified: true,
                },
                CommitRewrite {
                    old_sha: b.to_string(),
                    new_sha: "ph_b".to_string(),
                    author_name: "Test".to_string(),
                    author_email: "test@test.com".to_string(),
                    committer_name: "Test".to_string(),
                    committer_email: "test@test.com".to_string(),
                    message: "B".to_string(),
                    parent_shas: vec!["ph_a".to_string()],
                    is_modified: true,
                },
                CommitRewrite {
                    old_sha: c.to_string(),
                    new_sha: "ph_c".to_string(),
                    author_name: "Test".to_string(),
                    author_email: "test@test.com".to_string(),
                    committer_name: "Test".to_string(),
                    committer_email: "test@test.com".to_string(),
                    message: "C".to_string(),
                    parent_shas: vec!["ph_b".to_string()],
                    is_modified: true,
                },
            ],
            total_affected: 3,
            branches_affected: vec![],
            backup_ref: String::new(),
        };

        let result = apply_rewrite_plan(&repo, &plan).unwrap();

        assert_ne!(result[0].new_sha, result[1].new_sha);
        assert_ne!(result[1].new_sha, result[2].new_sha);

        let new_b = repo.find_commit(parse_oid(&result[1].new_sha).unwrap()).unwrap();
        let new_b_decoded = new_b.decode().unwrap();
        let b_parent: Vec<gix::ObjectId> = new_b_decoded.parents().collect();
        assert_eq!(b_parent[0].to_string(), result[0].new_sha);

        let new_c = repo.find_commit(parse_oid(&result[2].new_sha).unwrap()).unwrap();
        let new_c_decoded = new_c.decode().unwrap();
        let c_parent: Vec<gix::ObjectId> = new_c_decoded.parents().collect();
        assert_eq!(c_parent[0].to_string(), result[1].new_sha);
    }
}
