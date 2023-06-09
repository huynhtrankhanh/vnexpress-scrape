import * as fs from 'fs';
import path from 'path';
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import fetch from 'node-fetch';
import cheerio from 'cheerio';

const MyOctokit = Octokit.plugin(throttling);

const octokit = new MyOctokit({
  auth: process.env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter, options, octokit) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

      if (options.request.retryCount === 0) { // only retries once
        octokit.log.info(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
    },
    onAbuseLimit: (retryAfter, options, octokit) => {
      // does not retry, only logs a warning
      octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`);
    },
  },
});

async function main() {
  try {
    const response = await fetch('https://vnexpress.net/');
    const html = await response.text();
    const $ = cheerio.load(html);
    const headlines = $('h3').map((_, el) => $(el).text()).get();
    const content = headlines.join('\n');

    const filePath = 'headlines.txt';
    fs.writeFileSync(filePath, content);

    const { data: { sha: currentSha } } = await octokit.repos.getContent({
      owner: process.env.GITHUB_REPOSITORY_OWNER,
      repo: 'vnexpress-scrape',
      path: 'headlines.txt',
    });

    await octokit.repos.createOrUpdateFileContents({
      owner: process.env.GITHUB_REPOSITORY_OWNER,
      repo: 'vnexpress-scrape',
      path: 'headlines.txt',
      message: 'Update headlines',
      content: Buffer.from(content).toString('base64'),
      sha: currentSha,
    });
  } catch (error) {
    console.error(error);
  }
}

main();
