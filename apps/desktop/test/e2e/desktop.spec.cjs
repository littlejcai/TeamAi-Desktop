const { test, expect, _electron } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const { fixture } = require("../fixture.cjs");
test("real Electron IPC: resources, safe detail, error recovery and uninitialized state", async () => {
  const f = await fixture();
  let app;
  try {
    const executable =
      process.env.TEAMAI_PACKAGED_EXECUTABLE || require("electron");
    const args = [
      ...(process.env.TEAMAI_PACKAGED_EXECUTABLE
        ? []
        : [path.resolve(__dirname, "../..")]),
      "--no-tray",
      "--test-project",
      f.project,
      "--test-home",
      f.home,
    ];
    app = await _electron.launch({
      executablePath: executable,
      args,
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ":99" },
    });
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "资源库", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "example", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const sandbox = await page.evaluate(() => ({
      node: typeof window.require,
      bridge: typeof window.teamai.request,
    }));
    expect(sandbox).toEqual({ node: "undefined", bridge: "function" });
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", { name: "example", exact: true }),
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText("Example skill");
    await page.getByRole("button", { name: "关闭详情" }).click();
    await page
      .getByRole("textbox", { name: "搜索资源" })
      .fill("does-not-exist");
    await expect(page.getByText("没有匹配的资源")).toBeVisible();
    await page.getByRole("textbox", { name: "搜索资源" }).fill("");
    await page.screenshot({
      path: path.join(f.root, "desktop.png"),
      fullPage: true,
    });
    if (process.env.TEAMAI_SCREENSHOT_PATH)
      await fs.copyFile(
        path.join(f.root, "desktop.png"),
        process.env.TEAMAI_SCREENSHOT_PATH,
      );
    await fs.writeFile(
      path.join(f.project, ".teamai/config.yaml"),
      "repo: broken",
    );
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await fs.writeFile(path.join(f.project, ".teamai/config.yaml"), f.config);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "example", exact: true }),
    ).toBeVisible();
    await fs.rm(path.join(f.project, ".teamai/config.yaml"));
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(page.getByText("连接你的团队资源")).toBeVisible();
    await page.getByRole("button", { name: "开始初始化" }).click();
    await expect(
      page.getByRole("textbox", { name: "团队 Git 仓库" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "团队 Git 仓库" })
      .fill("https://user:password@example.test/group/repo.git");
    await page.getByRole("button", { name: "检查仓库与角色" }).click();
    await expect(page.getByRole("alert")).toContainText("嵌入凭据");
  } finally {
    if (app) await app.close();
    await f.cleanup();
  }
});
