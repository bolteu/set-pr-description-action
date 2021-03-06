import * as core from '@actions/core';
import * as github from '@actions/github';
import { gitExec, githubApiHandlerCreator } from './functions';
import getAssociatedPRsTitles from './get-associated-prs-titles';

async function run() {
  try {
    // const githubApiToken:string = core.getInput('github-pr-number');
    if (!github.context.payload.pull_request) {
      throw {
        message: "This action can only be executed from PR"
      }
    }
    const githubApiToken:string = core.getInput('github-token');
    const githubUserName:string = core.getInput('github-user-name');
    const githubUserEmail:string = core.getInput('github-user-email');

    const githubApi = githubApiHandlerCreator(github.context.payload, githubApiToken);
    const prNumber = github.context.payload.pull_request.number;
    const ghName = github.context.payload.pull_request.head.repo.name;
    const ghOwner = github.context.payload.pull_request.head.repo.owner.login;

    let githubCommits:GithubApiResponse[] = [];

    for (let i=0; githubCommits.length >= (i*100); i++) {
      const data = await githubApi({resource: `pulls/${prNumber}/commits`, params: {page: i+1, per_page: 100}});
      githubCommits = [...githubCommits, ...data];
    }

    const githubMergeCommitsList = githubCommits.filter((item:GithubApiResponse) => item.parents.length > 1);
    
    const githubMergeShaList = githubMergeCommitsList.map((item:GithubApiResponse) => item.parents[(item.parents.length - 1)].sha);

    const listOfPrTitles = await getAssociatedPRsTitles(githubApiToken, githubMergeShaList, {repo: ghName, owner: ghOwner});

    const body = `${listOfPrTitles.map(title => ` - ${title}\n`).join("")}`;
    await githubApi({method: 'PATCH', resource: `pulls/${prNumber}`, params: {body}});

    if (githubUserName) {
      await gitExec('config', '--global', 'user.name', `"${githubUserName}"`);
    }

    if (githubUserEmail) {
      await gitExec('config', '--global', 'user.email', `"${githubUserEmail}"`);
    }


    const time = (new Date()).toTimeString();
    core.setOutput("time", time);
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();

interface GithubApiResponse {
  [key: string]: any
}