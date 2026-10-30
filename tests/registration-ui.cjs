"use strict";
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createApp } = require("../server/index.cjs");
(async () => {
  const app = createApp({ env: {} });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
  });
  try {
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install({ time: new Date("2026-10-30T10:00Z") });
    await p.route("**/api/account", (r) => r.fulfill({ json: { user: null } }));
    let sent = 0;
    await p.route("**/api/auth/signup", (r) => {
      sent++;
      return r.fulfill(
        sent === 1
          ? {
              status: 429,
              json: {
                error: {
                  code: "auth_email_rate_limit",
                  message:
                    "O envio de confirmação está temporariamente limitado. Avise o suporte da plataforma.",
                  retryAfterSeconds: 2,
                },
              },
            }
          : {
              json: {
                message: "Confira seu e-mail para confirmar o cadastro.",
              },
            },
      );
    });
    let resend = 0;
    await p.route("**/api/auth/resend", (r) => {
      resend++;
      assert.equal(r.request().postDataJSON().email, "cliente@example.test");
      return r.fulfill({ json: { message: "Confira também o spam." } });
    });
    await p.goto("http://127.0.0.1:" + app.server.address().port + "/account");
    await p.getByRole("button", { name: "Criar conta", exact: true }).click();
    await p.locator("#account-name").fill("Vinicius");
    await p.locator("#account-last-name").fill("Oliveira");
    await p.locator("#account-email").fill("cliente@example.test");
    await p.locator("#account-password").fill("Example-password-123");
    await p.locator("#account-password-confirm").fill("Example-password-123");
    await p.locator("#account-submit").click();
    await p
      .getByText(/envio de confirmação está temporariamente limitado/)
      .waitFor();
    assert.equal(
      await p.locator("#account-password").inputValue(),
      "Example-password-123",
    );
    assert(await p.locator("#account-submit").isDisabled());
    assert.equal(sent, 1);
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    assert(!(await p.locator("#account-submit").isDisabled()));
    await p.getByRole("button", { name: "Criar conta", exact: true }).click();
    assert(await p.locator("#account-submit").isDisabled());
    await p.clock.runFor(3100);
    assert(!(await p.locator("#account-submit").isDisabled()));
    assert.equal(sent, 1, "automatic retry sends mail without user action");
    await p.locator("#account-password-confirm").fill("Example-password-123");
    await p.locator("#account-submit").click();
    await p
      .getByText("Confira seu e-mail para confirmar o cadastro.", {
        exact: true,
      })
      .waitFor();
    assert.equal(sent, 2);
    await p
      .getByRole("button", {
        name: "Reenviar confirmação de e-mail",
        exact: true,
      })
      .click();
    assert(!(await p.locator("#account-password").isVisible()));
    await p.locator("#account-submit").click();
    await p.getByText("Confira também o spam.", { exact: true }).waitFor();
    assert.equal(resend, 1);
    assert(await p.locator("#account-submit").isDisabled());
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.screenshot({
      path: "/tmp/smc-registration-confirmation.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS mobile registration quota message, passwords preserved on failure, cooldown/no automatic retries, independent login and confirmation resend",
    );
  } finally {
    await browser.close();
    await new Promise((r) => app.server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
