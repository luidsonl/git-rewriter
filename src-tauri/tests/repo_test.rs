#[test]
fn test_gix_open_valid_repo() {
    // We are going to test opening the current repository (git-rewriter)
    let current_dir = std::env::current_dir().unwrap();
    // src-tauri is the current dir for this test usually, we go up one level
    let workspace_root = current_dir.parent().unwrap();

    let repo_path = workspace_root.to_str().unwrap().to_string();

    // Directly use gix to test what the command does
    let repo = gix::open(&repo_path);
    assert!(repo.is_ok(), "Should successfully open the workspace root as a git repository");
}

#[test]
fn test_gix_open_invalid_repo() {
    // System temp dir is usually not a git repo
    let temp_dir = std::env::temp_dir();
    let repo_path = temp_dir.to_str().unwrap().to_string();

    let repo = gix::open(&repo_path);
    assert!(repo.is_err(), "Should fail to open a non-git directory");
}
