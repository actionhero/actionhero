function determineProjectRoot() {
  let projectRoot = process.cwd();
  if (process.env.project_root) {
    projectRoot = process.env.project_root;
  } else if (process.env.projectRoot) {
    projectRoot = process.env.projectRoot;
  } else if (process.env.PROJECT_ROOT) {
    projectRoot = process.env.PROJECT_ROOT;
  }

  return projectRoot;
}

export const projectRoot = determineProjectRoot();
