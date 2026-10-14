const { test, expect, _electron } = require("@playwright/test");
const path = require("node:path");
const fs = require("node:fs/promises");
const { promisify } = require("node:util");
const exec = promisify(require("node:child_process").execFile);
const { repairWrapper, marker } = require("../../src/hook-runtime.cjs");
const { fixture } = require("../fixture.cjs");
test("real Electron IPC: resources, safe detail, error recovery and uninitialized state", async ({}, testInfo) => {
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
      "--test-user-data",
      path.join(f.root, "desktop-state"),
    ];
    app = await _electron.launch({
      executablePath: executable,
      args,
      env: { ...process.env, DISPLAY: process.env.DISPLAY ?? ":99" },
    });
    const page = await app.firstWindow();
    const runtime = await app.evaluate(({ app }) => ({
      executable: process.execPath,
      entry: app.getAppPath() + "/node_modules/teamai-cli/dist/index.js",
    }));
    const wrapper = path.join(f.root, "teamai-runtime");
    await fs.writeFile(wrapper, marker + "\n" + runtime.entry);
    await repairWrapper({ wrapper, ...runtime });
    const cli =
      process.platform === "win32"
        ? await exec(
            "cmd.exe",
            ["/d", "/s", "/c", '""' + wrapper + '.cmd" --version"'],
            { windowsVerbatimArguments: true },
          )
        : await exec("/bin/sh", [wrapper, "--version"]);
    expect(cli.stdout).toMatch(/0\.22\.0/);

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
    await expect(page.getByRole("dialog")).not.toContainText("name: example");
    await page.screenshot({
      path: testInfo.outputPath("resource-detail.png"),
      fullPage: true,
    });
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      expect(
        await page.evaluate(() =>
          Boolean(document.activeElement.closest('[role="dialog"]')),
        ),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    expect(
      await page.evaluate(() => document.activeElement.textContent),
    ).toContain("example");
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", { name: "example", exact: true }),
      })
      .click();
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
    await page.screenshot({
      path: testInfo.outputPath("resources.png"),
      fullPage: true,
    });
    if (process.env.TEAMAI_SCREENSHOT_PATH)
      await fs.copyFile(
        path.join(f.root, "desktop.png"),
        process.env.TEAMAI_SCREENSHOT_PATH,
      );
    await page
      .getByRole("textbox", { name: "搜索资源" })
      .fill("Example resource");
    await expect(
      page.getByRole("heading", { name: "example", exact: true }),
    ).toBeVisible();
    await page.getByRole("textbox", { name: "搜索资源" }).fill("");
    await page.getByRole("button", { name: /设置与诊断/ }).click();
    await page
      .getByRole("textbox", { name: "Git 提交名", exact: true })
      .fill("Unsaved Review");
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "刷新", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await expect(
      page.getByRole("textbox", { name: "Git 提交名", exact: true }),
    ).toHaveValue("Unsaved Review");
    await page.getByRole("button", { name: /资源库/ }).click();
    await expect(
      page.getByRole("dialog", { name: "设置尚未保存" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "留在设置" }).click();
    await page.getByRole("button", { name: "恢复已保存设置" }).click();
    await page
      .getByRole("textbox", { name: "Git 提交名", exact: true })
      .fill("Saved Fixture");
    await page
      .getByRole("textbox", { name: "Git 提交邮箱", exact: true })
      .fill("saved@example.test");
    await page.getByRole("button", { name: /资源库/ }).click();
    await page.getByRole("button", { name: "保存并继续" }).click();
    await expect(
      page.getByRole("heading", { name: "资源库", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /设置与诊断/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Git 提交名", exact: true }),
    ).toHaveValue("Saved Fixture");
    await page
      .getByRole("textbox", { name: "Git 提交名", exact: true })
      .fill("Discarded");
    await page.getByRole("button", { name: /资源库/ }).click();
    await page.getByRole("button", { name: "放弃修改并继续" }).click();
    await page.getByRole("button", { name: /设置与诊断/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Git 提交名", exact: true }),
    ).toHaveValue("Saved Fixture");
    await page.getByRole("button", { name: "运行诊断" }).click();
    await expect(page.locator(".diagnosis pre")).not.toBeEmpty({
      timeout: 30000,
    });
    await page.screenshot({
      path: testInfo.outputPath("settings-diagnosis.png"),
      fullPage: true,
    });
    const exported = path.join(f.root, "diagnostics.txt");
    await app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({
        canceled: false,
        filePath: target,
      });
    }, exported);
    await page.getByRole("button", { name: "导出日志" }).click();
    await expect(page.getByText(`日志已保存：${exported}`)).toBeVisible();
    expect((await fs.readFile(exported, "utf8")).length).toBeGreaterThan(0);

    await page.getByRole("button", { name: /资源库/ }).click();
    await fs.writeFile(
      path.join(f.project, ".teamai/config.yaml"),
      "repo: broken",
    );
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "刷新", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await expect(page.getByRole("alert")).toBeVisible();
    await fs.writeFile(path.join(f.project, ".teamai/config.yaml"), f.config);
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "刷新", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "example", exact: true }),
    ).toBeVisible();
    await fs.rm(path.join(f.project, ".teamai/config.yaml"));
    await page.getByRole("button", { name: "刷新", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "刷新", exact: true }),
    ).toBeEnabled({ timeout: 30000 });
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
