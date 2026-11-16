// Plain JavaScript on purpose: this guard must run on an old Node that cannot run .ts files.
import { pathToFileURL } from 'node:url';

const MIN_MAJOR = 24;

/** Returns a message when `version` is older than Node 24, else null. */
export function nodeVersionProblem(version) {
  const major = Number(String(version).split('.')[0]);
  if (Number.isInteger(major) && major >= MIN_MAJOR) return null;
  return (
    `mtg-hypergeo needs Node ${MIN_MAJOR} or newer, but this is Node ${version}. ` +
    `Run "nvm use" in the project folder (.nvmrc names ${MIN_MAJOR}), then run the command again.`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problem = nodeVersionProblem(process.versions.node);
  if (problem !== null) {
    console.error(problem);
    process.exit(1);
  }
}
