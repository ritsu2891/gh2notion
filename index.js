const { Octokit } = require("@octokit/core");
const { Client } = require("@notionhq/client")
const dotenv = require("dotenv");
dotenv.config();

// https://api.github.com/search/issues?q=repo:ritsu2891/umefugo+type:issue&per_page=1&page=2

async function main() {
  try {
    const repo = process.env.GITHUB_REPO;
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const pageId = process.env.NOTION_DATABASE;

    const ghIssues = [];
    const issueIdToNotionPageId = {};

    const stateLabel = {
      'open': 'オープン',
      'closed': 'クローズ'
    }

    // =====================================
    // GitHubのIssueを全件取得 (とりあえず100まで対応)
    const ghIssueResponse = await octokit.request('GET /search/issues', {
      q: `repo:${repo}+type:issue`,
      per_page: 100
    });
    for (issue of ghIssueResponse.data.items) {
      // console.log(issue);
      ghIssues.push({
        title: issue.title,
        number: issue.number,
        state: stateLabel[issue.state],
        label: issue.labels ? issue.labels.map(label => label.name) : [],
        milestone: issue.milestone ? issue.milestone.title : null,
        url: issue.url,
        id: issue.id
      });
    }
    // console.log(ghIssues);

    // =====================================
    // Notionのページを全件取得して既にIssueに対応したページが作られたモノを調べる (とりあえず100まで対応)
    const searchResponse = await notion.databases.query({
      database_id: pageId,
      page_size: 100
    });
    for (page of searchResponse.results) {
      const ghIssueId = page.properties.ID.number;
      if (ghIssueId == null) continue;
      issueIdToNotionPageId[ghIssueId] = page.id;
    }

    // =====================================
    // GitHubのIssueを全件取得 (とりあえず100まで対応)
    for (issue of ghIssues) {
      const prop = {
        Name: {
          type: 'title',
          title: [{ text: { content: issue.title } }],
        },
        '付番': { number: issue.number },
        '状態': { select: { name: issue.state } },
        'ラベル': { multi_select: issue.label.map(issue => {return { name: issue };}) },
        'マイルストーン': issue.milestone ? { select: { name: issue.milestone } } : { select: null },
        URL: { url: issue.url },
        ID: { number: issue.id },
      };
      // console.log(prop);

      const issuePageId = issueIdToNotionPageId[issue.id];
      if (issuePageId) {
        const updateResponse = await notion.pages.update({
          page_id: issuePageId,
          properties: prop
        });
        // console.log(updateResponse);
      } else {
        const response = await notion.pages.create({
          parent: { database_id: pageId },
          properties: prop
        });
        // console.log(response);
      }
    }
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

main();