import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from "recharts";
import { Download, Upload, Trash2, PlusCircle, TrendingUp, Wallet } from "lucide-react";

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
const COLORS = ["#0088FE","#00C49F","#FFBB28","#FF8042","#A28CF4","#f472b6","#34d399","#fb7185","#60a5fa","#f59e0b"];

const DEFAULT_CATEGORIES = [
  "Groceries","Dining Out","Rent/Mortgage","Utilities","Transportation",
  "Health & Fitness","Entertainment","Shopping","Travel","Other","Income"
];

function loadLS(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch { return fallback; }
}
function saveLS(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

export default function App() {
  const [transactions, setTransactions] = useState(() => loadLS("pf_transactions", []));
  const [goals, setGoals] = useState(() => loadLS("pf_goals", []));
  const [categories, setCategories] = useState(() => loadLS("pf_categories", DEFAULT_CATEGORIES));
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [filterCategory, setFilterCategory] = useState("All");

  useEffect(() => saveLS("pf_transactions", transactions), [transactions]);
  useEffect(() => saveLS("pf_goals", goals), [goals]);
  useEffect(() => saveLS("pf_categories", categories), [categories]);

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      const ym = t.date?.slice(0, 7);
      const monthOK = !filterMonth || ym === filterMonth;
      const catOK = filterCategory === "All" || t.category === filterCategory;
      return monthOK && catOK;
    });
  }, [transactions, filterMonth, filterCategory]);

  const totals = useMemo(() => {
    // Month sums (filtered)
    const income = filteredTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = filteredTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const net = income - expenses;

    // Category breakdown (expenses only, abs values)
    const byCatMap = new Map();
    for (const t of filteredTx) {
      if (t.amount < 0) {
        const key = t.category || "Uncategorized";
        byCatMap.set(key, (byCatMap.get(key) || 0) + Math.abs(t.amount));
      }
    }
    const byCat = [...byCatMap.entries()].map(([name, value]) => ({ name, value }));

    // Monthly trend over all transactions (not filtered by month)
    const byMonthMap = new Map();
    for (const t of transactions) {
      const ym = t.date?.slice(0, 7) || "";
      if (!ym) continue;
      const entry = byMonthMap.get(ym) || { ym, income: 0, expenses: 0 };
      if (t.amount >= 0) entry.income += t.amount;
      else entry.expenses += Math.abs(t.amount);
      byMonthMap.set(ym, entry);
    }
    const byMonth = [...byMonthMap.values()].sort((a,b)=> a.ym.localeCompare(b.ym));

    return { income, expenses, net, byCat, byMonth };
  }, [filteredTx, transactions]);

  const monthlyBudgetTarget = useMemo(
    () => goals.reduce((s, g) => s + (g.target || 0) / 12, 0),
    [goals]
  );

  const addTransaction = (tx) =>
    setTransactions((prev) => [{ id: crypto.randomUUID(), ...tx }, ...prev]);
  const removeTransaction = (id) =>
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  const addGoal = (g) => setGoals((prev) => [{ id: crypto.randomUUID(), ...g }, ...prev]);
  const removeGoal = (id) => setGoals((prev) => prev.filter((g) => g.id !== id));
  const addCategory = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) setCategories([...categories, trimmed]);
  };

  const importCSV = (text) => {
    // Supports: date,description,amount,category[,type]
    // - If "type" missing: infer from sign (amount < 0 => expense; >0 => income)
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;
    const cols = lines[0].toLowerCase().split(",").map(s => s.trim());
    const hasHeader = ["date","description","amount","category"].every(h => cols.includes(h));
    const rows = hasHeader ? lines.slice(1) : lines;

    const idx = (name) => cols.indexOf(name);
    const hasType = hasHeader && idx("type") !== -1;

    const parsed = rows.map((line) => {
      const parts = line.split(",").map(s => s.trim());
      const date = parts[hasHeader ? idx("date") : 0] || "";
      const description = parts[hasHeader ? idx("description") : 1] || "";
      const amtStr = parts[hasHeader ? idx("amount") : 2] || "0";
      const category = parts[hasHeader ? idx("category") : 3] || "Other";
      const typeRaw = hasType ? (parts[idx("type")] || "").toLowerCase() : "";
      const amt = parseFloat(amtStr) || 0;
      let amount = amt;
      if (hasType) {
        if (typeRaw.startsWith("exp")) amount = -Math.abs(amt);
        else amount = Math.abs(amt);
      } else {
        // infer from sign
        amount = amt;
      }
      return { id: crypto.randomUUID(), date: date.slice(0,10), description, amount, category };
    });
    setTransactions((prev) => [...parsed, ...prev]);
  };

  const exportCSV = () => {
    const header = "date,description,amount,category,type";
    const rows = transactions.map((t) => {
      const type = t.amount < 0 ? "expense" : "income";
      return [t.date, cleanCSV(t.description), t.amount, cleanCSV(t.category), type].join(",");
    });
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetAll = () => {
    if (confirm("This will delete all transactions, goals, and categories. Continue?")) {
      setTransactions([]);
      setGoals([]);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Wallet className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Personal Finance Dashboard</h1>
          <div className="ml-auto flex gap-2">
            <button
              onClick={exportCSV}
              className="px-3 py-1.5 rounded-lg border hover:bg-gray-100 flex items-center gap-1"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <ImportCSV onImport={importCSV} />
            <button
              onClick={resetAll}
              className="px-3 py-1.5 rounded-lg border hover:bg-red-50 text-red-600 flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid gap-6">
        {/* Filters */}
        <section className="grid lg:grid-cols-3 gap-3">
          <div className="p-4 bg-white rounded-2xl shadow-sm border">
            <label className="block text-sm text-gray-500">Month</label>
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2"
            />
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-sm border">
            <label className="block text-sm text-gray-500">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2"
            >
              <option>All</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="p-4 bg-white rounded-2xl shadow-sm border">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-xs text-gray-500">Income</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {currency.format(totals.income)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Spend</p>
                <p className="text-lg font-semibold text-red-600">
                  {currency.format(totals.expenses)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Net Cash Flow</p>
                <p className={`text-lg font-semibold ${totals.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {currency.format(totals.net)}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
              <span>Implied Monthly Target*</span>
              <span className={`${totals.expenses > monthlyBudgetTarget ? "text-red-600" : "text-emerald-600"} font-medium`}>
                {currency.format(monthlyBudgetTarget || 0)}
              </span>
            </div>
          </div>
        </section>

        {/* Quick add */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-4 bg-white rounded-2xl shadow-sm border">
            <h2 className="font-medium mb-3">Add Transaction</h2>
            <TransactionForm
              onAdd={addTransaction}
              categories={categories}
              onAddCategory={addCategory}
            />
          </div>
          <div className="p-4 bg-white rounded-2xl shadow-sm border">
            <h2 className="font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Add Goal
            </h2>
            <GoalForm onAdd={addGoal} />
          </div>
        </section>

        {/* Summary Cards */}
        <section className="grid md:grid-cols-3 gap-6">
          <Card title="Category Breakdown (Expenses)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie dataKey="value" data={totals.byCat} cx="50%" cy="50%" outerRadius={90} label>
                    {totals.byCat.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v, n) => [currency.format(v), n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
              {totals.byCat.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>{c.name}</span>
                  <span className="font-medium">{currency.format(c.value)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Monthly Trend (Income vs Spend)">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totals.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ym" />
                  <YAxis />
                  <ReTooltip formatter={(v) => currency.format(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Income" />
                  <Bar dataKey="expenses" name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Goals Progress">
            <div className="space-y-3">
              {goals.length === 0 && (
                <p className="text-sm text-gray-500">No goals yet. Add one on the right.</p>
              )}
              {goals.map((g) => {
                const pct = Math.min(100, Math.round(((g.current || 0) / (g.target || 1)) * 100));
                return (
                  <div key={g.id} className="p-3 rounded-xl border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium">{g.name}</div>
                      <button
                        onClick={() => removeGoal(g.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 mb-1 flex justify-between">
                      <span>
                        {currency.format(g.current || 0)} / {currency.format(g.target || 0)}
                      </span>
                      <span>{g.due ? `Due ${g.due}` : ""}</span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: pct + "%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>

        {/* Transactions Table */}
        <section className="p-4 bg-white rounded-2xl shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium">Transactions ({filteredTx.length})</h2>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.map((t) => {
                  const isIncome = t.amount >= 0;
                  return (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 pr-3 whitespace-nowrap">{t.date}</td>
                      <td className="py-2 pr-3">{t.description}</td>
                      <td className="py-2 pr-3">{t.category}</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${isIncome ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {isIncome ? "Income" : "Expense"}
                        </span>
                      </td>
                      <td className={`py-2 pr-3 text-right font-medium ${isIncome ? "text-emerald-700" : "text-red-700"}`}>
                        {currency.format(t.amount)}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <button
                          onClick={() => removeTransaction(t.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="text-xs text-gray-500 text-center pb-8">
          * Implied Monthly Target is (sum of goal targets ÷ 12). It’s compared to monthly <em>spend</em>.
        </footer>
      </main>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="p-4 bg-white rounded-2xl shadow-sm border">
      <h2 className="font-medium mb-3">{title}</h2>
      {children}
    </div>
  );
}

function TransactionForm({ onAdd, categories, onAddCategory }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] || "Other");
  const [newCategory, setNewCategory] = useState("");
  const [type, setType] = useState("expense"); // 'expense' | 'income'

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] || "Other");
  }, [categories]);

  const submit = (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return alert("Enter an amount > 0");
    const signed = type === "expense" ? -Math.abs(amt) : Math.abs(amt);
    onAdd({ date, description, amount: signed, category });
    setDescription("");
    setAmount("");
    setType("expense");
  };

  const addCat = () => {
    if (newCategory.trim()) {
      onAddCategory(newCategory);
      setNewCategory("");
      setCategory(newCategory.trim());
    }
  };

  return (
    <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
      <div>
        <label className="block text-sm text-gray-500">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm text-gray-500">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Whole Foods or Paycheck"
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full border rounded-xl px-3 py-2"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-500">Category</label>
        <div className="flex gap-2 mt-1">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="flex-1 border rounded-xl px-3 py-2"
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="md:col-span-6 grid md:grid-cols-3 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-500">Add a new category (optional)</label>
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g., Subscriptions or Salary"
            className="mt-1 w-full border rounded-xl px-3 py-2"
          />
        </div>
        <button
          type="button"
          onClick={addCat}
          className="px-3 py-2 rounded-xl border hover:bg-gray-100 flex items-center gap-2 justify-center"
        >
          <PlusCircle className="w-4 h-4" /> Add Category
        </button>
      </div>

      <div className="md:col-span-6 flex justify-end">
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:brightness-110"
        >
          Add Transaction
        </button>
      </div>
    </form>
  );
}

function GoalForm({ onAdd }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [due, setDue] = useState(""); // yyyy-mm

  const submit = (e) => {
    e.preventDefault();
    if (!name || !target) return alert("Enter a goal name and target");
    onAdd({ name, target: Number(target), current: Number(current || 0), due });
    setName("");
    setTarget("");
    setCurrent("");
    setDue("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div>
        <label className="block text-sm text-gray-500">Goal Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Emergency Fund"
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500">Target Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500">Current Saved</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="0.00"
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-500">Due (optional)</label>
        <input
          type="month"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="mt-1 w-full border rounded-xl px-3 py-2"
        />
      </div>
      <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white hover:brightness-110">
        Add Goal
      </button>
    </form>
  );
}

function ImportCSV({ onImport }) {
  const handle = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onImport(String(reader.result || ""));
    reader.readAsText(file);
  };
  return (
    <label className="px-3 py-1.5 rounded-lg border hover:bg-gray-100 flex items-center gap-1 cursor-pointer">
      <Upload className="w-4 h-4" /> Import
      <input type="file" accept=".csv,text/csv" onChange={handle} className="hidden" />
    </label>
  );
}

function cleanCSV(s) {
  if (s == null) return "";
  const needsQuotes = /[",\n]/.test(String(s));
  const escaped = String(s).replaceAll('"', '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}
