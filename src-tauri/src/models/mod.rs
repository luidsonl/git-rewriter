use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CommitInfo {
    pub sha: String,
    pub author_name: String,
    pub author_email: String,
    pub author_date: String,
    pub committer_name: String,
    pub committer_email: String,
    pub commit_date: String,
    pub message: String,
    pub parent_shas: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Contributor {
    pub id: String,
    pub name: String,
    pub email: String,
    pub commit_count: usize,
    pub commit_shas: Vec<String>,
}

impl Contributor {
    pub fn new(name: String, email: String) -> Self {
        let id = format!("{} <{}>", name, email);
        Contributor {
            id,
            name,
            email,
            commit_count: 0,
            commit_shas: Vec::new(),
        }
    }

    pub fn add_commit(&mut self, sha: String) {
        self.commit_count += 1;
        self.commit_shas.push(sha);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoSummary {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub repo_name: String,
    pub total_commits: usize,
    pub total_branches: usize,
    pub contributors: Vec<Contributor>,
    pub commits: Vec<CommitInfo>,
}
