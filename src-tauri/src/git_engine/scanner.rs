use std::path::PathBuf;
use crate::models::{CommitInfo, Contributor, ScanResult};
use anyhow::Result;

/// Scans all reachable commits from all local branches via gix.
pub fn scan_repository(repo_path: &str) -> Result<ScanResult> {
    let repo = gix::open(repo_path)?;

    let repo_name = PathBuf::from(repo_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let mut commits: Vec<CommitInfo> = Vec::new();

    // Walk all commits reachable from HEAD (or all references)
    let head_id = repo.head_id().ok();

    if let Some(head) = head_id {
        let walk = repo.rev_walk([head]);
        for item in walk.all()? {
            let info = item?;
            let commit = repo.find_commit(info.id)?;
            let commit_ref = commit.decode()?;

            let sha = info.id.to_string();
            let parent_shas: Vec<String> = commit_ref
                .parents()
                .map(|p| p.to_string())
                .collect();

            let author = commit_ref.author().ok();
            let author_name = author.as_ref().map(|a| a.name.to_string()).unwrap_or_default();
            let author_email = author.as_ref().map(|a| a.email.to_string()).unwrap_or_default();
            let author_date = author.as_ref().map(|a| a.time.to_string()).unwrap_or_default();

            let committer = commit_ref.committer().ok();
            let committer_name = committer.as_ref().map(|c| c.name.to_string()).unwrap_or_default();
            let committer_email = committer.as_ref().map(|c| c.email.to_string()).unwrap_or_default();
            let commit_date = committer.as_ref().map(|c| c.time.to_string()).unwrap_or_default();

            let message = commit_ref.message().title.to_string();

            commits.push(CommitInfo {
                sha,
                author_name,
                author_email,
                author_date,
                committer_name,
                committer_email,
                commit_date,
                message,
                parent_shas,
            });
        }
    }

    // Count branches
    let total_branches = repo
        .references()?
        .local_branches()?
        .count();

    let contributors = extract_contributors(&commits);
    let total_commits = commits.len();

    Ok(ScanResult {
        repo_name,
        total_commits,
        total_branches,
        contributors,
        commits,
    })
}

/// Derives a deduplicated list of contributors from the commit list.
pub fn extract_contributors(commits: &[CommitInfo]) -> Vec<Contributor> {
    use std::collections::HashMap;

    let mut map: HashMap<String, Contributor> = HashMap::new();

    for commit in commits {
        // Track author
        let author_key = format!("{} <{}>", commit.author_name, commit.author_email);
        let author = map
            .entry(author_key)
            .or_insert_with(|| Contributor::new(commit.author_name.clone(), commit.author_email.clone()));
        author.add_commit(commit.sha.clone());

        // Track committer only if different from author
        let committer_key = format!("{} <{}>", commit.committer_name, commit.committer_email);
        if committer_key != format!("{} <{}>", commit.author_name, commit.author_email) {
            let committer = map
                .entry(committer_key)
                .or_insert_with(|| Contributor::new(commit.committer_name.clone(), commit.committer_email.clone()));
            committer.add_commit(commit.sha.clone());
        }
    }

    let mut contributors: Vec<Contributor> = map.into_values().collect();
    // Sort by most commits desc
    contributors.sort_by(|a, b| b.commit_count.cmp(&a.commit_count));
    contributors
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_commit(sha: &str, author_name: &str, author_email: &str) -> CommitInfo {
        CommitInfo {
            sha: sha.to_string(),
            author_name: author_name.to_string(),
            author_email: author_email.to_string(),
            author_date: "0".to_string(),
            committer_name: author_name.to_string(),
            committer_email: author_email.to_string(),
            commit_date: "0".to_string(),
            message: "test".to_string(),
            parent_shas: vec![],
        }
    }

    #[test]
    fn test_extract_contributors_deduplicates() {
        let commits = vec![
            make_commit("sha1", "Alice", "alice@example.com"),
            make_commit("sha2", "Alice", "alice@example.com"),
            make_commit("sha3", "Bob", "bob@example.com"),
        ];

        let contributors = extract_contributors(&commits);

        assert_eq!(contributors.len(), 2);
        // Alice should be first (most commits)
        assert_eq!(contributors[0].name, "Alice");
        assert_eq!(contributors[0].commit_count, 2);
        assert_eq!(contributors[1].name, "Bob");
        assert_eq!(contributors[1].commit_count, 1);
    }

    #[test]
    fn test_extract_contributors_tracks_committer_separately() {
        let mut commit = make_commit("sha1", "Alice", "alice@example.com");
        commit.committer_name = "Bot".to_string();
        commit.committer_email = "bot@ci.com".to_string();

        let contributors = extract_contributors(&[commit]);

        // Both author and committer should appear separately
        assert_eq!(contributors.len(), 2);
        let names: Vec<&str> = contributors.iter().map(|c| c.name.as_str()).collect();
        assert!(names.contains(&"Alice"));
        assert!(names.contains(&"Bot"));
    }

    #[test]
    fn test_extract_contributors_empty() {
        let contributors = extract_contributors(&[]);
        assert!(contributors.is_empty());
    }

    #[test]
    fn test_scan_repository_on_workspace() {
        let current_dir = std::env::current_dir().unwrap();
        let workspace = current_dir.parent().unwrap().to_str().unwrap().to_string();

        let result = scan_repository(&workspace);
        assert!(result.is_ok(), "Should scan workspace repo without error");

        let scan = result.unwrap();
        assert!(!scan.commits.is_empty(), "Should find at least 1 commit");
        assert!(!scan.contributors.is_empty(), "Should find at least 1 contributor");
    }
}
