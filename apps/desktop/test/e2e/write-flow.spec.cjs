const { test, expect, _electron } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const { fixture } = require("../fixture.cjs");
const { startServer } = require("../fixture-server.cjs");
test("actual desktop wizard, confirmed sync and contribution partial-failure recovery", async ({}, testInfo) => {
  const f = await fixture();
  let app, server;
  try {
    const remote = await startServer(f);
    server = remote.server;
    const project = path.join(f.root, "wizard-project");
    await fs.mkdir(path.join(project, ".claude"), { recursive: true });
    await fs.writeFile(path.join(project, ".claude/settings.json"), "{}");
    const executable =
      process.env.TEAMAI_PACKAGED_EXECUTABLE || require("electron");
    const args = [
      ...(process.env.TEAMAI_PACKAGED_EXECUTABLE
        ? []
        : [path.resolve(__dirname, "../..")]),
      "--no-tray",
      "--test-project",
      project,
      "--test-home",
      f.home,
      "--test-user-data",
      path.join(f.root, "desktop-state"),
    ];
    app = await _electron.launch({
      executablePath: executable,
      args,
      env: {
        ...process.env,
        ...remote.env,
        DISPLAY: process.env.DISPLAY ?? ":99",
      },
    });
    const page = await app.firstWindow();
    await page.getByRole("button", { name: "开始初始化" }).click();
    await page
      .getByRole("textbox", { name: "团队 Git 仓库" })
      .fill(remote.repo);
    await page.getByRole("button", { name: "检查仓库与角色" }).click();
    await expect(page.getByText("developer · Developer")).toHaveCount(1);
    await page.getByRole("checkbox", { name: /claude/ }).check();
    await page.getByRole("checkbox", { name: /codex/ }).uncheck();
    await page.screenshot({
      path: testInfo.outputPath("setup.png"),
      fullPage: true,
    });
    await page.getByRole("checkbox", { name: /确认以上仓库/ }).check();
    await page.getByRole("button", { name: "完成初始化" }).click();
    await expect(
      page.getByRole("heading", { name: "检查团队更新" }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText("初始化完成。前往同步中心获取团队资源。"),
    ).toBeVisible();
    await page.getByRole("button", { name: /资源库/ }).click();
    await expect(
      page.getByRole("heading", { name: "example", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: /同步中心/ }).click();
    await page.getByRole("checkbox", { name: /我允许预检/ }).check();
    await page.getByRole("button", { name: "检查同步计划" }).click();
    await expect(
      page.getByRole("heading", { name: "同步预检结果" }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "执行同步" })).toBeDisabled();
    await page.screenshot({
      path: testInfo.outputPath("sync-preview.png"),
      fullPage: true,
    });
    await page.getByRole("checkbox", { name: /我确认同步/ }).check();
    await page.getByRole("button", { name: "执行同步" }).click();
    await expect(
      page.getByText("同步完成。可前往资源库核对部署状态。"),
    ).toBeVisible({
      timeout: 30000,
    });
    await page.getByRole("button", { name: /资源库/ }).click();
    await expect(page.getByText("已核对部署 · claude")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("deployed-resources.png"),
      fullPage: true,
    });
    const skill = path.join(project, ".claude/skills/desktop-ui-new");
    await fs.mkdir(skill);
    await fs.writeFile(
      path.join(skill, "SKILL.md"),
      "---\nname: desktop-ui-new\ndescription: UI contribution\n---\n# UI contribution\n",
    );
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await page.getByRole("button", { name: /贡献回团队/ }).click();
    await expect(
      page.getByText("desktop-ui-new", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button")
      .filter({ hasText: "desktop-ui-new" })
      .click();
    await expect(page.getByRole("dialog")).toContainText("UI contribution");
    await page.getByRole("button", { name: "关闭详情" }).click();
    await expect(
      page.getByRole("button", { name: "提交所有变更" }),
    ).toBeDisabled();
    await page.getByRole("checkbox", { name: /已核对所有变更/ }).check();
    await page.getByRole("button", { name: "提交所有变更" }).click();
    await expect(page.getByRole("alert")).toContainText("分支已推送", {
      timeout: 30000,
    });
    await expect(
      page.getByText(
        "贡献操作已结束。请在日志中确认 PR/MR 或手动创建请求的提示。",
      ),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "分支已推送，待创建评审" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "远端分支" })).toHaveValue(
      /teamai\/push\//,
    );
    await expect(
      page.getByRole("button", { name: "提交所有变更" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: /已核对所有变更/ }),
    ).not.toBeChecked();
    await page.screenshot({
      path: testInfo.outputPath("push-result.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "复制分支名" }).click();
    await expect(page.getByText("已复制分支名。")).toBeVisible();
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText());
    expect(copied).toMatch(/teamai\/push\//);
    const branches = execFileSync(
      "git",
      [
        "--git-dir",
        remote.bare,
        "for-each-ref",
        "--format=%(refname)",
        "refs/heads",
      ],
      { encoding: "utf8" },
    );
    expect(branches).toMatch(/teamai\/push\//);
  } finally {
    if (app) await app.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await f.cleanup();
  }
});
