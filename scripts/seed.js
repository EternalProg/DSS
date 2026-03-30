const { connectToDb } = require("../services/db");

async function seed() {
  const db = await connectToDb();

  await Promise.all([
    db.collection("alternatives").deleteMany({}),
    db.collection("criteria").deleteMany({}),
    db.collection("evaluations").deleteMany({})
  ]);

  const alternatives = [
    {
      name: "Moodle",
      description: "Платформа з відкритим кодом для онлайн-курсів"
    },
    {
      name: "Google Classroom",
      description: "Проста система з інтеграцією сервісів Google"
    },
    {
      name: "Canvas LMS",
      description: "Сучасна LMS з широким набором інструментів"
    },
    {
      name: "Власний вебсайт",
      description: "Розробка власної платформи під університет"
    }
  ];

  const criteria = [
    {
      name: "Вартість використання",
      type: "minimize",
      description: "Витрати на впровадження та підтримку",
      weight: 7
    },
    {
      name: "Функціональні можливості",
      type: "maximize",
      description: "Наявність інструментів для навчання",
      weight: 9
    },
    {
      name: "Зручність використання",
      type: "maximize",
      description: "Зрозумілий інтерфейс для викладачів і студентів",
      weight: 8
    },
    {
      name: "Інтеграція з іншими сервісами",
      type: "maximize",
      description: "Підключення до зовнішніх сервісів",
      weight: 6
    },
    {
      name: "Надійність роботи системи",
      type: "maximize",
      description: "Стабільність та масштабованість",
      weight: 9
    },
    {
      name: "Технічна підтримка та оновлення",
      type: "maximize",
      description: "Доступність підтримки та регулярність оновлень",
      weight: 5
    }
  ];

  const alternativeResult = await db
    .collection("alternatives")
    .insertMany(alternatives);
  const criterionResult = await db
    .collection("criteria")
    .insertMany(criteria);

  const alternativeIds = Object.values(alternativeResult.insertedIds);
  const criterionIds = Object.values(criterionResult.insertedIds);

  const evaluations = [];
  const values = [
    [6, 8, 7, 6, 8, 7],
    [8, 6, 9, 7, 7, 6],
    [5, 9, 8, 8, 9, 8],
    [3, 10, 6, 9, 6, 5]
  ];

  alternativeIds.forEach((altId, altIndex) => {
    criterionIds.forEach((critId, critIndex) => {
      evaluations.push({
        alternativeId: altId,
        criterionId: critId,
        value: values[altIndex][critIndex]
      });
    });
  });

  await db.collection("evaluations").insertMany(evaluations);

  console.log("Seed data inserted.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exit(1);
});
