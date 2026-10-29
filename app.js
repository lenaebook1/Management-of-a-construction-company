"use strict";

// ключ localStorage
const STORAGE_KEY = "object360-project-v1";

// данные
const DEFAULT_DATA = {
  budget: 1500000,
  tasks: [
    { id: 1, name: "Подготовить основание пола",   worker: "Бригада № 1",       priority: "high",   done: true  },
    { id: 2, name: "Выполнить монтаж перегородок", worker: "Бригада № 2",       priority: "normal", done: false },
    { id: 3, name: "Проверить электропроводку",    worker: "Электромонтажники", priority: "high",   done: false }
  ],
  materials: [
    { id: 4, name: "Цемент М500",  qty: 25,  price: 480 },
    { id: 5, name: "Кабель ВВГнг", qty: 100, price: 85  }
  ]
};

// querySelector ищет элемент по CSS-селектору (например, "#toast"). ФУНКЦИЯ    
const $ = (selector) => document.querySelector(selector);

// рубли с разделителями тысяч.
const money = (value) => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 2
}).format(value);

// копия демо-данных. stringify превращает объект в JSON-строку
function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

// загрузка данных 
function loadData() {
  try {
    // getItem читает значение по ключу.
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaults();

    // parse разбирает строку JSON в объект JavaScript.
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.materials)
      || !Number.isFinite(parsed.budget) || parsed.budget <= 0) {
      return cloneDefaults();
    }
    return parsed;
  } catch (error) {
    return cloneDefaults();
  }
}

// при старте загружаем данные из localStorage
let data = loadData();
let activeFilter = "all";
let toastTimer;

// сохранение данных 
function saveData() {
  // setItem записывает строку по ключу.
  // сериализуем через JSON.stringify.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// всплывающее уведомление 
function notify(message) {
  const toast = $("#toast");
  // textContent вставляет текст БЕЗ парсинга HTML (защита от атак: нельзя вставить скрипт).
  toast.textContent = message;
  // add добавляет CSS-класс "show" 
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// ненерация  id.
function nextId() {
  const ids = [...data.tasks, ...data.materials].map(item => item.id);
  // находит максимальный id
  return Math.max(0, ...ids) + 1;
}

// сумма всех закупок
function totalSpent() {
  // reduce сворачивает массив в одно число.
  return data.materials.reduce((sum, item) => sum + item.qty * item.price, 0);
}

// количество выполненных задач
function completedCount() {
  // filter оставляет только выполненные,
  return data.tasks.filter(task => task.done).length;
}

// процент готовности объекта
function completionPercent() {
  if (data.tasks.length === 0) return 0;
  // Math.round округляет до целого.
  return Math.round(completedCount() / data.tasks.length * 100);
}

// обновление блока статистики.
function renderStats() {
  const spent = totalSpent();
  const left = data.budget - spent;

  $("#statTotal").textContent  = data.tasks.length;
  $("#statDone").textContent   = completedCount();
  $("#statSpent").textContent  = money(spent);
  $("#statLeft").textContent   = money(left);
  $("#progressText").textContent = completionPercent() + "%";

  // width задаёт ширину полосы прогресса.
  $("#progressBar").style.width = completionPercent() + "%";
}

// возвращает задачи по активному фильтру
function filteredTasks() {
  if (activeFilter === "done")   return data.tasks.filter(task => task.done);
  if (activeFilter === "active") return data.tasks.filter(task => !task.done);
  if (activeFilter === "high")   return data.tasks.filter(task => task.priority === "high");
  return data.tasks;
}

// утилита для создания DOM-элемента
function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  // className задаёт CSS-класс элементу
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// отрисовка списка задач
function renderTasks() {
  const list = $("#taskList");
  // replaceChildren очищает контейнер перед новой отрисовкой.
  list.replaceChildren();

  const tasks = filteredTasks();
  if (tasks.length === 0) {
    list.append(makeElement("p", "empty", "Задачи не найдены"));
    return;
  }

  // forEach перебирает задачи и создаёт DOM для каждой
  tasks.forEach(task => {
    const row = makeElement("div", "task" + (task.done ? " done" : ""));

    const check = makeElement("input");
    check.type = "checkbox";
    check.checked = task.done;
    check.setAttribute("aria-label", "Выполнена: " + task.name);
    check.addEventListener("change", () => toggleTask(task.id));

    const main = makeElement("div", "task-main");
    main.append(makeElement("div", "task-title", task.name));
    main.append(makeElement("div", "task-meta",  task.worker));

    const badge = makeElement(
      "span",
      "priority" + (task.priority === "high" ? " high" : ""),
      task.priority === "high" ? "Срочно" : "Планово"
    );

    const remove = makeElement("button", "remove", "×");
    remove.type = "button";
    remove.setAttribute("aria-label", "Удалить задачу");
    remove.addEventListener("click", () => deleteTask(task.id));

    row.append(check, main, badge, remove);
    list.append(row);
  });
}

// добавление задачи
function addTask(event) {
  // preventDefault отменяет перезагрузку страницы
  event.preventDefault();

  // trim убирает пробелы по краям строки
  const name     = $("#taskName").value.trim();
  const worker   = $("#taskWorker").value.trim();
  const priority = $("#taskPriority").value;

  if (!name || !worker) return notify("Заполните название и исполнителя");
  if (name.length > 70 || worker.length > 40) return notify("Слишком длинное название");

  // push добавляет новый объект в конец массива
  data.tasks.push({ id: nextId(), name, worker, priority, done: false });
  saveData();
  $("#taskForm").reset();
  renderAll();
  notify("Задача добавлена");
}

// переключение статуса «выполнено»
function toggleTask(id) {
  const task = data.tasks.find(item => item.id === id);
  if (!task) return;
  task.done = !task.done;
  saveData();
  renderAll();
}

// удаление задачи
function deleteTask(id) {
  data.tasks = data.tasks.filter(task => task.id !== id);
  saveData();
  renderAll();
  notify("Задача удалена");
}

// отрисовка таблицы материалов
function renderMaterials() {
  const tbody = $("#materialRows");
  tbody.replaceChildren();

  if (data.materials.length === 0) {
    const tr = makeElement("tr");
    const td = makeElement("td", "empty", "Материалов пока нет");
    td.colSpan = 4;
    tr.append(td);
    tbody.append(tr);
  }

  data.materials.forEach(item => {
    const tr   = makeElement("tr");
    const name = makeElement("td", "", item.name);
    const qty  = makeElement("td", "", String(item.qty));
    const cost = makeElement("td", "", money(item.qty * item.price));

    const action = makeElement("td");
    const button = makeElement("button", "remove", "×");
    button.type = "button";
    button.setAttribute("aria-label", "Удалить материал");
    button.addEventListener("click", () => deleteMaterial(item.id));
    action.append(button);

    tr.append(name, qty, cost, action);
    tbody.append(tr);
  });

  $("#materialCount").textContent = data.materials.length;
  $("#totalCost").textContent     = money(totalSpent());
}

// добавление материала
function addMaterial(event) {
  event.preventDefault();
  const name  = $("#materialName").value.trim();
  const qty   = Number($("#materialQty").value);
  const price = Number($("#materialPrice").value);

  if (!name || !Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price < 0)
    return notify("Проверьте название, количество и цену");
  if (name.length > 70) return notify("Слишком длинное название");

  data.materials.push({ id: nextId(), name, qty, price });
  saveData();
  $("#materialForm").reset();
  renderAll();
  notify("Материал добавлен");
}

// удаление материала
function deleteMaterial(id) {
  data.materials = data.materials.filter(item => item.id !== id);
  saveData();
  renderAll();
  notify("Материал удалён");
}

// отрисовка бюджета
function renderBudget() {
  const spent = totalSpent();
  const ratio = spent / data.budget * 100;

  $("#budgetInput").value = data.budget;
  // Math.min ограничивает полосу 100%
 $("#budgetBar").style.width = Math.min(ratio, 100) + "%";
  $("#budgetBar").classList.toggle("over", ratio > 100);

  $("#budgetStatus").textContent = ratio > 100
    ? "Бюджет превышен на " + money(spent - data.budget)
    : "Использовано " + ratio.toFixed(1) + "% бюджета. Доступно: " + money(data.budget - spent);
}

// сохранение нового бюджета
function updateBudget(event) {
  event.preventDefault();
  const value = Number($("#budgetInput").value);
  if (!Number.isFinite(value) || value <= 0) return notify("Введите положительный бюджет");
  data.budget = value;
  saveData();
  renderAll();
  notify("Бюджет обновлён");
}

// экранирование значения для CSV-ячейки
function csvCell(value) {
  // replaceAll удваивает двойные кавычки внутри значения
  return '"' + String(value).replaceAll('"', '""') + '"';
}

// формирование и скачивание отчёта
function exportReport() {
  const rows = [
    ["ОТЧЁТ ПО ОБЪЕКТУ 360"],
    ["Бюджет", data.budget],
    ["Расходы", totalSpent()],
    ["Остаток", data.budget - totalSpent()],
    [],
    ["ЗАДАЧИ"],
    ["Название", "Исполнитель", "Приоритет", "Статус"],
    ...data.tasks.map(task => [
      task.name, task.worker,
      task.priority === "high" ? "Срочно" : "Планово",
      task.done ? "Готово" : "В работе"
    ]),
    [],
    ["МАТЕРИАЛЫ"],
    ["Название", "Количество", "Цена, руб.", "Сумма, руб."],
    ...data.materials.map(item => [item.name, item.qty, item.price, item.qty * item.price])
  ];

  // BOM ("\uFEFF") нужен, чтобы эксель корректно распознал кириллицу.
  const csv = "\uFEFF" + rows.map(row => row.map(csvCell).join(";")).join("\r\n");

  // Blob создаёт «файл в памяти» браузера.
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

  // createObjectURL создаёт временную ссылку на blob.
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "otchet_object360.csv";
  document.body.append(link);

  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Отчёт сформирован");
}

// сброс проекта к демо-данным
function resetProject() {
  // сonfirm показывает окно с кнопками
  if (!confirm("Удалить все изменения и восстановить демонстрационный проект?")) return;
  data = cloneDefaults();
  activeFilter = "all";
  $("#taskFilter").value = "all";
  saveData();
  renderAll();
  notify("Данные восстановлены");
}

// полная перерисовка всех блоков интерфейса
function renderAll() {
  renderStats();
  renderTasks();
  renderMaterials();
  renderBudget();
}

// инициализация приложения при загрузке 
function init() {
  $("#today").textContent = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "long", year: "numeric"
  }).format(new Date());

  $("#taskForm").addEventListener("submit", addTask);
  $("#materialForm").addEventListener("submit", addMaterial);
  $("#budgetForm").addEventListener("submit", updateBudget);

  // фильтр задач
  $("#taskFilter").addEventListener("change", event => {
    activeFilter = event.target.value;
    renderTasks();
  });

  $("#exportBtn").addEventListener("click", exportReport);
  $("#resetBtn").addEventListener("click", resetProject);

  renderAll();
}

init();