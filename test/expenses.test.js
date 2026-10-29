const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadPage, isHidden } = require("./helpers");

// Fills the form and submits it. Returns true if the page would have reloaded.
function addExpense(page, desc, amount, category = "food") {
  page.$("#desc").value = desc;
  page.$("#amount").value = String(amount);
  page.choose("#category", category);
  return page.submit("#expense-form");
}

const rows = (page) => page.$$("#rows tr");
const descs = (page) => rows(page).map((tr) => tr.querySelector("td")?.textContent.trim());
const amounts = (page) => rows(page).map((tr) => tr.querySelectorAll("td")[2]?.textContent.trim());
const total = (page) => page.$("#total").textContent.trim();
const deleteBtn = (tr) => tr.querySelector("button.delete");
const errorBox = (page) => page.$("#form-error");

// ---------- Step 1: add an expense ----------

test("Step 1: submitting the form adds a row without reloading the page", async () => {
  const page = await loadPage();
  const reloaded = addExpense(page, "Pizza", 42.5);
  assert.equal(reloaded, false, "the page should not reload - call event.preventDefault() in the submit listener");
  assert.equal(rows(page).length, 1, "after adding one expense the table should have one row in #rows");
});

test("Step 1: after adding, desc and amount are cleared and desc gets the focus", async () => {
  const page = await loadPage();
  page.$('#expense-form [type="submit"]').focus();
  addExpense(page, "Pizza", 42.5);
  assert.equal(page.$("#desc").value, "", "#desc should be empty after adding");
  assert.equal(page.$("#amount").value, "", "#amount should be empty after adding");
  assert.equal(page.document.activeElement, page.$("#desc"), "the focus should go back to #desc (use .focus())");
});

test("Step 1: an empty description is not added and shows an error", async () => {
  const page = await loadPage();
  addExpense(page, "", 10);
  assert.equal(rows(page).length, 0, "an expense without a description should not be added");
  assert.ok(!errorBox(page).hidden, "#form-error should be shown (remove the hidden attribute)");
  assert.equal(errorBox(page).textContent.trim(), "Please add a description", "the error should be: Please add a description");
  addExpense(page, "    ", 10);
  assert.equal(rows(page).length, 0, "a description with only spaces should not be added");
});

test("Step 1: an amount that is empty, 0 or negative is not added and shows an error", async () => {
  const page = await loadPage();
  for (const amount of ["", 0, -5]) {
    addExpense(page, "Pizza", amount);
    assert.equal(rows(page).length, 0, `an amount of "${amount}" should not be added`);
    assert.ok(!errorBox(page).hidden, "#form-error should be shown");
    assert.equal(errorBox(page).textContent.trim(), "The amount must be larger than 0", "the error should be: The amount must be larger than 0");
  }
});

test("Step 1: a successful add hides the error again", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 0);
  assert.ok(!errorBox(page).hidden, "#form-error should be shown after a bad amount");
  addExpense(page, "Pizza", 10);
  assert.ok(errorBox(page).hidden, "after a successful add #form-error should be hidden again (hidden = true)");
});

test("Step 1: every expense gets a different id", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 10);
  addExpense(page, "Pizza", 10);
  addExpense(page, "Pizza", 10);
  const ids = rows(page).map((tr) => deleteBtn(tr)?.dataset.id);
  assert.ok(ids.every((id) => id !== undefined && id !== ""), "every delete button should have a data-id");
  assert.equal(new Set(ids).size, 3, "the ids should be unique (a number that goes up with every add)");
});

// ---------- Step 2: render ----------

test("Step 2: a row has 4 cells: description, category badge, amount, delete button", async () => {
  const page = await loadPage();
  addExpense(page, "Taxi", 42.5, "transport");
  const tr = rows(page)[0];
  const tds = tr.querySelectorAll("td");
  assert.equal(tds.length, 4, "each row (tr) should have 4 td cells");
  assert.equal(tds[0].textContent.trim(), "Taxi", "the first cell should be the description");
  const badge = tds[1].querySelector("span.badge");
  assert.ok(badge, "the second cell should contain <span class=\"badge\">");
  assert.equal(badge.textContent.trim().toLowerCase(), "transport", "the badge should show the category");
  assert.equal(tds[2].textContent.trim(), "42.50", "the amount should have 2 digits after the dot (toFixed(2))");
  const btn = tds[3].querySelector("button.delete");
  assert.ok(btn, "the fourth cell should contain <button class=\"delete\">");
  assert.ok(btn.dataset.id, "the delete button should have data-id with the id of the expense");
});

test("Step 2: rows are shown in the order they were added", async () => {
  const page = await loadPage();
  addExpense(page, "First", 1);
  addExpense(page, "Second", 2);
  addExpense(page, "Third", 3);
  assert.deepEqual(descs(page), ["First", "Second", "Third"], "the rows should follow the order of the array");
});

test("Step 2: the no-rows message hides when there are rows and comes back when there are none", async () => {
  const page = await loadPage();
  const noRows = page.$("#no-rows");
  addExpense(page, "Pizza", 10);
  assert.ok(isHidden(noRows), "with one expense #no-rows should be hidden");
  page.click(deleteBtn(rows(page)[0]));
  assert.ok(!isHidden(noRows), "with no expenses #no-rows should be shown");
});

// ---------- Step 3: delete ----------

test("Step 3: the delete button removes the expense", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 10);
  addExpense(page, "Taxi", 20);
  page.click(deleteBtn(rows(page)[0]));
  assert.deepEqual(descs(page), ["Taxi"], "clicking delete on Pizza should leave only Taxi");
});

test("Step 3: delete removes the right expense when two have the same description", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 10);
  addExpense(page, "Pizza", 20);
  page.click(deleteBtn(rows(page)[1]));
  assert.deepEqual(amounts(page), ["10.00"], "deleting the second Pizza should leave the one with 10.00");

  addExpense(page, "Pizza", 30);
  page.click(deleteBtn(rows(page)[0]));
  assert.deepEqual(amounts(page), ["30.00"], "after another add + delete, the right row should be removed");
});

// ---------- Step 4: total ----------

test("Step 4: the total is the sum of the expenses, with 2 digits", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 42.5);
  addExpense(page, "Bus", 12, "transport");
  assert.equal(total(page), "54.50", "42.5 + 12 should show a total of 54.50");
});

test("Step 4: the total updates after delete", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 42.5);
  addExpense(page, "Bus", 12, "transport");
  page.click(deleteBtn(rows(page)[0]));
  assert.equal(total(page), "12.00", "after deleting Pizza the total should be 12.00");
  page.click(deleteBtn(rows(page)[0]));
  assert.equal(total(page), "0.00", "with no expenses the total should be 0.00");
});

// ---------- Step 5: filter ----------

test("Step 5: the filter shows only the chosen category and updates the total", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 40, "food");
  addExpense(page, "Bus", 12, "transport");
  addExpense(page, "Burger", 30, "food");

  page.choose("#filter", "food");
  assert.deepEqual(descs(page), ["Pizza", "Burger"], "with the Food filter only food expenses should be shown");
  assert.equal(total(page), "70.00", "the total should only count the shown expenses");

  page.choose("#filter", "transport");
  assert.deepEqual(descs(page), ["Bus"], "with the Transport filter only Bus should be shown");
  assert.equal(total(page), "12.00", "the total should be 12.00");

  page.choose("#filter", "all");
  assert.deepEqual(descs(page), ["Pizza", "Bus", "Burger"], "All categories should show everything again");
  assert.equal(total(page), "82.00", "the total of all should be 82.00");
});

test("Step 5: a category with no expenses shows the no-rows message", async () => {
  const page = await loadPage();
  addExpense(page, "Pizza", 40, "food");
  assert.ok(isHidden(page.$("#no-rows")), "with one expense #no-rows should be hidden");
  page.choose("#filter", "bills");
  assert.equal(rows(page).length, 0, "no row should be shown for Bills");
  assert.ok(!isHidden(page.$("#no-rows")), "#no-rows should be shown when nothing matches the filter");
  assert.equal(total(page), "0.00", "the total should be 0.00");
});

// ---------- Step 6: sort ----------

test("Step 6: the sort button switches its text between on and off", async () => {
  const page = await loadPage();
  const btn = page.$("#sort-btn");
  page.click(btn);
  assert.equal(btn.textContent.trim(), "Sort by amount: on", "after one click the button should say: Sort by amount: on");
  page.click(btn);
  assert.equal(btn.textContent.trim(), "Sort by amount: off", "after a second click the button should say: Sort by amount: off");
});

test("Step 6: sorting shows high to low, and turning it off brings back the original order", async () => {
  const page = await loadPage();
  addExpense(page, "Small", 5);
  addExpense(page, "Big", 80);
  addExpense(page, "Medium", 20);
  page.click("#sort-btn");
  assert.deepEqual(descs(page), ["Big", "Medium", "Small"], "with sort on, rows should go from the highest amount to the lowest");
  page.click("#sort-btn");
  assert.deepEqual(descs(page), ["Small", "Big", "Medium"], "with sort off, rows should be back in the order they were added (use toSorted)");
});

test("Step 6: adding while sorted puts the new expense in the right place", async () => {
  const page = await loadPage();
  addExpense(page, "Small", 5);
  addExpense(page, "Big", 80);
  page.click("#sort-btn");
  addExpense(page, "Medium", 20);
  assert.deepEqual(descs(page), ["Big", "Medium", "Small"], "a new expense should appear in its sorted place");
});

// ---------- Step 7: highlight ----------

test("Step 7: an expense above 100 gets the class big", async () => {
  const page = await loadPage();
  addExpense(page, "Laptop", 150);
  addExpense(page, "Exactly", 100);
  addExpense(page, "Just above", 100.01);
  const [laptop, exactly, above] = rows(page);
  assert.ok(laptop.classList.contains("big"), "an amount of 150 should give the tr the class big");
  assert.ok(!exactly.classList.contains("big"), "an amount of exactly 100 should NOT get the class big");
  assert.ok(above.classList.contains("big"), "an amount of 100.01 should give the tr the class big");
});
