use std::collections::HashMap;
use crate::models::{
    CommitInfo, CommitRewrite, IdentityRewrite, RewriteOperation, RewritePlan,
};

fn compute_new_sha(old_sha: &str, content: &str) -> String {
    use sha1::{Sha1, Digest};
    let mut hasher = Sha1::new();
    hasher.update(old_sha.as_bytes());
    hasher.update(b":");
    hasher.update(content.as_bytes());
    let result = hasher.finalize();
    hex::encode(result)
}

fn matches_identity(commit: &CommitInfo, op: &IdentityRewrite) -> bool {
    (commit.author_name == op.old_name && commit.author_email == op.old_email)
        || (commit.committer_name == op.old_name && commit.committer_email == op.old_email)
}

fn apply_identity(
    value: &str,
    old_name: &str,
    old_email: &str,
    new_name: &str,
    new_email: &str,
) -> String {
    if value == old_name { new_name.to_string() }
    else if value == old_email { new_email.to_string() }
    else { value.to_string() }
}

fn topological_depth(commits: &[CommitInfo]) -> HashMap<String, usize> {
    let mut depth: HashMap<String, usize> = HashMap::new();
    for c in commits {
        depth.entry(c.sha.clone()).or_insert(0);
    }
    loop {
        let mut changed = false;
        for c in commits {
            let parent_max = c.parent_shas.iter()
                .filter_map(|p| depth.get(p))
                .max()
                .copied()
                .unwrap_or(0);
            let next = parent_max + 1;
            if depth.get(&c.sha) != Some(&next) {
                depth.insert(c.sha.clone(), next);
                changed = true;
            }
        }
        if !changed { break; }
    }
    depth
}

pub fn compute_rewrite_plan(
    commits: &[CommitInfo],
    operations: &[RewriteOperation],
) -> RewritePlan {
    let depth = topological_depth(commits);
    let mut order: Vec<usize> = (0..commits.len()).collect();
    order.sort_by_key(|&i| depth.get(&commits[i].sha).copied().unwrap_or(0));

    let mut sha_map: HashMap<String, String> = HashMap::new();
    let mut rewrites: Vec<CommitRewrite> = Vec::new();
    let mut total_affected = 0;

    for &i in &order {
        let commit = &commits[i];
        let mut new_author_name = commit.author_name.clone();
        let mut new_author_email = commit.author_email.clone();
        let mut new_committer_name = commit.committer_name.clone();
        let mut new_committer_email = commit.committer_email.clone();
        let mut new_message = commit.message.clone();
        let mut new_parent_shas = commit.parent_shas.clone();
        let mut is_modified = false;

        for op in operations {
            match op {
                RewriteOperation::Identity(identity) => {
                    if matches_identity(commit, identity) {
                        new_author_name = apply_identity(
                            &commit.author_name,
                            &identity.old_name,
                            &identity.old_email,
                            &identity.new_name,
                            &identity.new_email,
                        );
                        new_author_email = apply_identity(
                            &commit.author_email,
                            &identity.old_name,
                            &identity.old_email,
                            &identity.new_name,
                            &identity.new_email,
                        );
                        if identity.rewrite_committer {
                            new_committer_name = apply_identity(
                                &commit.committer_name,
                                &identity.old_name,
                                &identity.old_email,
                                &identity.new_name,
                                &identity.new_email,
                            );
                            new_committer_email = apply_identity(
                                &commit.committer_email,
                                &identity.old_name,
                                &identity.old_email,
                                &identity.new_name,
                                &identity.new_email,
                            );
                        }
                        is_modified = true;
                    }
                }
                RewriteOperation::Message(edit) => {
                    if commit.sha == edit.target_sha {
                        new_message = edit.new_message.clone();
                        is_modified = true;
                    }
                }
                RewriteOperation::AuthorDate(edit) => {
                    if commit.sha == edit.target_sha {
                        is_modified = true;
                    }
                }
            }
        }

        for parent in &commit.parent_shas {
            if let Some(new_parent) = sha_map.get(parent.as_str()) {
                if new_parent != parent {
                    for p in &mut new_parent_shas {
                        if p == parent {
                            *p = new_parent.clone();
                        }
                    }
                    is_modified = true;
                }
            }
        }

        let new_sha = if is_modified {
            total_affected += 1;
            let content = format!(
                "{}\n{}\n{}\n{}\n{}\n{}\n{:?}\n{}",
                new_author_name, new_author_email, new_committer_name,
                new_committer_email, new_message, commit.author_date,
                new_parent_shas, commit.commit_date
            );
            compute_new_sha(&commit.sha, &content)
        } else {
            commit.sha.clone()
        };

        sha_map.insert(commit.sha.clone(), new_sha.clone());

        rewrites.push(CommitRewrite {
            old_sha: commit.sha.clone(),
            new_sha,
            author_name: new_author_name,
            author_email: new_author_email,
            committer_name: new_committer_name,
            committer_email: new_committer_email,
            message: new_message,
            parent_shas: new_parent_shas,
            is_modified,
        });
    }

    let branches_affected: Vec<String> = Vec::new();

    RewritePlan {
        rewrites,
        total_affected,
        branches_affected,
        backup_ref: String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::MessageEdit;

    fn make_commit(
        sha: &str,
        author_name: &str,
        author_email: &str,
        committer_name: &str,
        committer_email: &str,
        message: &str,
        parent_shas: Vec<&str>,
    ) -> CommitInfo {
        CommitInfo {
            sha: sha.to_string(),
            author_name: author_name.to_string(),
            author_email: author_email.to_string(),
            author_date: "1000".to_string(),
            committer_name: committer_name.to_string(),
            committer_email: committer_email.to_string(),
            commit_date: "1000".to_string(),
            message: message.to_string(),
            parent_shas: parent_shas.into_iter().map(String::from).collect(),
        }
    }

    #[test]
    fn test_no_operations_returns_same_shas() {
        let commits = vec![
            make_commit("aaa", "Alice", "alice@test.com", "Alice", "alice@test.com", "first", vec![]),
            make_commit("bbb", "Bob", "bob@test.com", "Bob", "bob@test.com", "second", vec!["aaa"]),
        ];

        let plan = compute_rewrite_plan(&commits, &[]);

        assert_eq!(plan.total_affected, 0);
        assert_eq!(plan.rewrites[0].new_sha, "aaa");
        assert_eq!(plan.rewrites[1].new_sha, "bbb");
        assert!(!plan.rewrites[0].is_modified);
        assert!(!plan.rewrites[1].is_modified);
    }

    #[test]
    fn test_identity_rewrite_changes_sha_and_propagates() {
        let commits = vec![
            make_commit("aaa", "Alice", "alice@old.com", "Alice", "alice@old.com", "first", vec![]),
            make_commit("bbb", "Bob", "bob@test.com", "Bob", "bob@test.com", "second", vec!["aaa"]),
            make_commit("ccc", "Charlie", "charlie@test.com", "Charlie", "charlie@test.com", "third", vec!["bbb"]),
        ];

        let operations = vec![
            RewriteOperation::Identity(IdentityRewrite {
                old_name: "Alice".to_string(),
                old_email: "alice@old.com".to_string(),
                new_name: "Alice New".to_string(),
                new_email: "alice@new.com".to_string(),
                rewrite_committer: true,
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert_eq!(plan.total_affected, 3, "All 3 commits should be affected (Alice + descendants)");
        assert!(plan.rewrites[0].is_modified, "Alice's commit should change");
        assert_eq!(plan.rewrites[0].author_name, "Alice New");
        assert_eq!(plan.rewrites[0].author_email, "alice@new.com");
        assert_ne!(plan.rewrites[0].new_sha, "aaa");

        assert!(plan.rewrites[1].is_modified, "Bob's commit should change (parent changed)");
        assert_eq!(plan.rewrites[1].parent_shas[0], plan.rewrites[0].new_sha,
            "Bob's parent should point to Alice's new SHA");

        assert!(plan.rewrites[2].is_modified, "Charlie's commit should change (parent changed)");
        assert_eq!(plan.rewrites[2].parent_shas[0], plan.rewrites[1].new_sha,
            "Charlie's parent should point to Bob's new SHA");
    }

    #[test]
    fn test_message_edit_changes_only_target_and_descendants() {
        let commits = vec![
            make_commit("aaa", "Alice", "a@t.com", "Alice", "a@t.com", "first", vec![]),
            make_commit("bbb", "Bob", "b@t.com", "Bob", "b@t.com", "second", vec!["aaa"]),
            make_commit("ccc", "Charlie", "c@t.com", "Charlie", "c@t.com", "third", vec!["bbb"]),
        ];

        let operations = vec![
            RewriteOperation::Message(MessageEdit {
                target_sha: "bbb".to_string(),
                new_message: "EDITED".to_string(),
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert!(!plan.rewrites[0].is_modified, "Alice should not change");
        assert!(plan.rewrites[1].is_modified, "Bob should change (message edit)");
        assert_eq!(plan.rewrites[1].message, "EDITED");
        assert!(plan.rewrites[2].is_modified, "Charlie should change (parent changed)");
        assert_eq!(plan.rewrites[2].parent_shas[0], plan.rewrites[1].new_sha);
    }

    #[test]
    fn test_identity_rewrite_only_author_when_rewrite_committer_false() {
        let commits = vec![
            make_commit("aaa", "Alice", "alice@old.com", "Bot", "bot@ci.com", "msg", vec![]),
        ];

        let operations = vec![
            RewriteOperation::Identity(IdentityRewrite {
                old_name: "Alice".to_string(),
                old_email: "alice@old.com".to_string(),
                new_name: "Alice New".to_string(),
                new_email: "alice@new.com".to_string(),
                rewrite_committer: false,
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert_eq!(plan.rewrites[0].author_name, "Alice New");
        assert_eq!(plan.rewrites[0].committer_name, "Bot",
            "Committer should not change when rewrite_committer is false");
    }

    #[test]
    fn test_merge_commit_preserves_both_parents() {
        let commits = vec![
            make_commit("aaa", "Alice", "a@t.com", "Alice", "a@t.com", "root", vec![]),
            make_commit("bbb", "Bob", "b@t.com", "Bob", "b@t.com", "branch1", vec!["aaa"]),
            make_commit("ccc", "Charlie", "c@t.com", "Charlie", "c@t.com", "branch2", vec!["aaa"]),
            make_commit("ddd", "Diana", "d@t.com", "Diana", "d@t.com", "merge", vec!["bbb", "ccc"]),
        ];

        let operations = vec![
            RewriteOperation::Message(MessageEdit {
                target_sha: "aaa".to_string(),
                new_message: "ROOT EDITED".to_string(),
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        let merge = &plan.rewrites[3];
        assert!(merge.is_modified, "Merge commit should be modified");
        assert_eq!(merge.parent_shas.len(), 2, "Merge should have 2 parents");
        assert_eq!(merge.parent_shas[0], plan.rewrites[1].new_sha,
            "First parent should be Bob's new SHA");
        assert_eq!(merge.parent_shas[1], plan.rewrites[2].new_sha,
            "Second parent should be Charlie's new SHA");
    }

    #[test]
    fn test_multiple_identity_rewrites() {
        let commits = vec![
            make_commit("aaa", "John", "john@old.com", "John", "john@old.com", "msg1", vec![]),
            make_commit("bbb", "J.", "john@new.com", "J.", "john@new.com", "msg2", vec!["aaa"]),
            make_commit("ccc", "Alice", "a@t.com", "Alice", "a@t.com", "msg3", vec!["bbb"]),
        ];

        let operations = vec![
            RewriteOperation::Identity(IdentityRewrite {
                old_name: "John".to_string(),
                old_email: "john@old.com".to_string(),
                new_name: "John Doe".to_string(),
                new_email: "john@unified.com".to_string(),
                rewrite_committer: true,
            }),
            RewriteOperation::Identity(IdentityRewrite {
                old_name: "J.".to_string(),
                old_email: "john@new.com".to_string(),
                new_name: "John Doe".to_string(),
                new_email: "john@unified.com".to_string(),
                rewrite_committer: true,
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert_eq!(plan.rewrites[0].author_name, "John Doe");
        assert_eq!(plan.rewrites[0].author_email, "john@unified.com");
        assert_eq!(plan.rewrites[1].author_name, "John Doe");
        assert_eq!(plan.rewrites[1].author_email, "john@unified.com");

        assert!(plan.rewrites[2].is_modified, "Alice's commit should change (parent was rewritten)");
        assert_eq!(plan.rewrites[2].author_name, "Alice",
            "Alice's name should remain unchanged");
    }

    #[test]
    fn test_no_parent_change_means_no_descendant_rewrite() {
        let commits = vec![
            make_commit("aaa", "Alice", "a@t.com", "Alice", "a@t.com", "root", vec![]),
            make_commit("bbb", "Bob", "b@t.com", "Bob", "b@t.com", "second", vec!["aaa"]),
        ];

        let operations = vec![
            RewriteOperation::Message(MessageEdit {
                target_sha: "bbb".to_string(),
                new_message: "EDITED".to_string(),
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert!(!plan.rewrites[0].is_modified, "Root should not change");
        assert!(plan.rewrites[1].is_modified, "Target should change");
        assert_eq!(plan.rewrites[1].message, "EDITED");
    }

    #[test]
    fn test_cascade_works_with_newest_first_order() {
        // Scanner returns commits newest-first. This test verifies that
        // compute_rewrite_plan correctly cascades parent changes even
        // when children appear before parents in the input list.
        let commits = vec![
            make_commit("bbb", "Bob", "b@t.com", "Bob", "b@t.com", "second", vec!["aaa"]),
            make_commit("aaa", "Alice", "a@old.com", "Alice", "a@old.com", "first", vec![]),
        ];

        let operations = vec![
            RewriteOperation::Identity(IdentityRewrite {
                old_name: "Alice".to_string(),
                old_email: "a@old.com".to_string(),
                new_name: "Alice New".to_string(),
                new_email: "a@new.com".to_string(),
                rewrite_committer: true,
            }),
        ];

        let plan = compute_rewrite_plan(&commits, &operations);

        assert_eq!(plan.total_affected, 2, "Both commits should be affected (root + child)");
        assert!(plan.rewrites[0].is_modified, "Root should be modified");
        assert!(plan.rewrites[1].is_modified, "Child should be modified (parent changed)");
        assert_eq!(plan.rewrites[1].parent_shas[0], plan.rewrites[0].new_sha,
            "Child's parent should point to root's new SHA");
    }

    #[test]
    fn test_empty_commits() {
        let plan = compute_rewrite_plan(&[], &[]);
        assert_eq!(plan.total_affected, 0);
        assert!(plan.rewrites.is_empty());
    }
}
