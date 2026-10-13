
"use strict";

// ==============================
// 1. Mobile navigation
// ==============================

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");

menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.textContent = isOpen ? "✕" : "☰";
});

document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
        mainNav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.textContent = "☰";
    });
});

function showPage(pageId) {
    const page = document.getElementById(pageId);
    const activePage = page && page.parentElement.tagName === "MAIN"
        ? page
        : document.getElementById("home");

    document.querySelectorAll("main > section").forEach((section) => {
        const isActive = section === activePage;

        section.classList.toggle("page-hidden", !isActive);
        section.setAttribute("aria-hidden", String(!isActive));
    });

    if (activePage.id !== "learning") {
        document.getElementById("lessonPanel").classList.add("hidden");
        document.getElementById("learningGrid").classList.remove("hidden");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function navigateTo(pageId) {
    const page = document.getElementById(pageId);

    if (!page || page.parentElement.tagName !== "MAIN") return;

    if (window.location.hash !== `#${pageId}`) {
        window.history.pushState(null, "", `#${pageId}`);
    }

    showPage(pageId);
}

document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');

    if (!link) return;

    const pageId = link.getAttribute("href").slice(1);

    if (!document.getElementById(pageId)) return;

    event.preventDefault();
    navigateTo(pageId);

    if (link.dataset.lesson) {
        openLesson(link.dataset.lesson);
    }
});

window.addEventListener("popstate", () => {
    showPage(window.location.hash.slice(1) || "home");
});

const voiceToggle = document.getElementById("voiceToggle");
const voiceToggleLabel = document.getElementById("voiceToggleLabel");
let readOnClick = false;

function speakText(text) {
    const spokenText = text.replace(/\s+/g, " ").trim();

    if (!spokenText || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = document.documentElement.lang === "ar" ? "ar-EG" : "en-US";
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
}

voiceToggle.addEventListener("click", () => {
    if (!("speechSynthesis" in window)) {
        voiceToggle.disabled = true;
        voiceToggle.setAttribute("aria-label", "القراءة الصوتية غير مدعومة");
        return;
    }

    readOnClick = !readOnClick;
    voiceToggle.setAttribute("aria-pressed", String(readOnClick));
    voiceToggle.classList.toggle("is-active", readOnClick);

    const label = readOnClick
        ? "أوقف القراءة الصوتية"
        : "شغّل القراءة الصوتية";
    voiceToggleLabel.textContent = label;
    voiceToggle.setAttribute("aria-label", label);
    voiceToggle.title = label;

    if (readOnClick) {
        speakText("تم تشغيل القراءة الصوتية. اضغط على أي نص لسماعه.");
    } else {
        window.speechSynthesis.cancel();
    }
});

document.addEventListener("click", (event) => {
    if (!readOnClick || event.target.closest("#voiceToggle, #storyListen, #speakSentence")) {
        return;
    }

    const readableElement = event.target.closest(
        "button, a, h1, h2, h3, h4, p, li, .eyebrow, .hero-stats div, .feature-card, .learning-card, .story-card"
    );
    const text = readableElement?.innerText || event.target.innerText;

    if (text) speakText(text);
});


// ==============================
// 2. Learning activities
// ==============================

const lessonData = {
    colors: {
        title: "🎨 عالم الألوان",
        questions: [
            {
                prompt: "اختار اللون الأحمر.",
                options: [
                    { label: "🔴 أحمر", value: "red" },
                    { label: "🔵 أزرق", value: "blue" },
                    { label: "🟢 أخضر", value: "green" }
                ],
                answer: "red"
            },
            {
                prompt: "أي فاكهة لونها أصفر؟",
                options: [
                    { label: "🍌 موز", value: "yellow" },
                    { label: "🍓 فراولة", value: "red" },
                    { label: "🍇 عنب", value: "purple" }
                ],
                answer: "yellow"
            },
            {
                prompt: "ماذا نحصل عند مزج الأحمر والأزرق؟",
                options: [
                    { label: "🟣 بنفسجي", value: "purple" },
                    { label: "🟢 أخضر", value: "green" },
                    { label: "🟡 أصفر", value: "yellow" }
                ],
                answer: "purple"
            }
        ],
    },

    numbers: {
        title: "🔢 رحلة الأرقام",
        questions: [
            {
                prompt: "إيه الرقم اللي بييجي بعد ٢؟",
                options: [
                    { label: "١", value: "1" },
                    { label: "٣", value: "3" },
                    { label: "٥", value: "5" }
                ],
                answer: "3"
            },
            {
                prompt: "كام نجمة هنا؟ ⭐ ⭐ ⭐",
                options: [
                    { label: "٢", value: "2" },
                    { label: "٣", value: "3" },
                    { label: "٤", value: "4" }
                ],
                answer: "3"
            },
            {
                prompt: "إيه الرقم اللي قبل ٥؟",
                options: [
                    { label: "٣", value: "3" },
                    { label: "٤", value: "4" },
                    { label: "٦", value: "6" }
                ],
                answer: "4"
            }
        ],
    },

    shapes: {
        title: "🔺 الأشكال حولنا",
        questions: [
            {
                prompt: "أنهي رمز بيمثل المثلث؟",
                options: [
                    { label: "⚪ دائرة", value: "circle" },
                    { label: "🔺 مثلث", value: "triangle" },
                    { label: "🟦 مربع", value: "square" }
                ],
                answer: "triangle"
            },
            {
                prompt: "أي شكل يشبه وجه الساعة؟",
                options: [
                    { label: "⚪ دائرة", value: "circle" },
                    { label: "🔺 مثلث", value: "triangle" },
                    { label: "🟦 مربع", value: "square" }
                ],
                answer: "circle"
            },
            {
                prompt: "أي شكل له أربعة أضلاع متساوية؟",
                options: [
                    { label: "⚪ دائرة", value: "circle" },
                    { label: "🔺 مثلث", value: "triangle" },
                    { label: "🟦 مربع", value: "square" }
                ],
                answer: "square"
            }
        ],
    },

    routine: {
        title: "🌞 روتيني الصباحي",
        questions: [
            {
                prompt: "إيه حاجة مفيدة نعملها بعد ما نصحى؟",
                options: [
                    { label: "🪥 غسل الأسنان", value: "teeth" },
                    { label: "😴 ننام تاني", value: "sleep" },
                    { label: "🧸 نلعب طول اليوم", value: "play" }
                ],
                answer: "teeth"
            },
            {
                prompt: "بعد ما نلبس، ممكن نعمل إيه؟",
                options: [
                    { label: "🍞 نتناول الفطور", value: "breakfast" },
                    { label: "🛏️ نرجع ننام", value: "sleep" },
                    { label: "🧸 نخبي ملابسنا", value: "hide" }
                ],
                answer: "breakfast"
            },
            {
                prompt: "إيه اللي نعمله قبل النوم؟",
                options: [
                    { label: "🪥 غسل الأسنان", value: "teeth" },
                    { label: "🍳 نبدأ الفطور", value: "breakfast" },
                    { label: "🎒 نذهب للمدرسة", value: "school" }
                ],
                answer: "teeth"
            }
        ],
    }
};

const lessonPanel = document.getElementById("lessonPanel");
const learningGrid = document.getElementById("learningGrid");
const lessonTitle = document.getElementById("lessonTitle");
const lessonQuestion = document.getElementById("lessonQuestion");
const lessonOptions = document.getElementById("lessonOptions");
const lessonFeedback = document.getElementById("lessonFeedback");
const lessonScore = document.getElementById("lessonScore");

let currentLesson = null;
let currentLessonKey = null;
let currentQuestionIndex = 0;
let lessonAttempts = 0;
let lessonCorrect = 0;
let lessonAnswered = false;

function openLesson(key) {
    currentLesson = lessonData[key];

    if (!currentLesson) return;

    currentLessonKey = key;
    currentQuestionIndex = 0;
    lessonAttempts = 0;
    lessonCorrect = 0;

    lessonTitle.textContent = currentLesson.title;
    renderLessonQuestion();

    learningGrid.classList.add("hidden");
    lessonPanel.classList.remove("hidden");
    lessonPanel.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function renderLessonQuestion() {
    const question = currentLesson.questions[currentQuestionIndex];

    lessonAnswered = false;
    lessonQuestion.textContent =
        `السؤال ${currentQuestionIndex + 1} من ${currentLesson.questions.length}: ` +
        question.prompt;
    lessonFeedback.textContent = "";
    lessonScore.textContent =
        `النتيجة: ${lessonCorrect} من ${lessonAttempts}`;
    lessonOptions.replaceChildren();

    question.options.forEach((option) => {
        const button = document.createElement("button");

        button.className = "lesson-option";
        button.textContent = option.label;
        button.type = "button";
        button.addEventListener("click", () => {
            checkLessonAnswer(option.value, button);
        });

        lessonOptions.appendChild(button);
    });
}

function checkLessonAnswer(value, selectedButton) {
    if (lessonAnswered) return;

    lessonAnswered = true;
    lessonAttempts++;

    const question = currentLesson.questions[currentQuestionIndex];
    const isCorrect = value === question.answer;

    if (isCorrect) {
        lessonCorrect++;
        lessonFeedback.textContent = "أحسنت! إجابة صحيحة 💚";
    } else {
        lessonFeedback.textContent =
            "محاولة جميلة! الإجابة الصحيحة هي: " +
            question.options.find(
                (option) => option.value === question.answer
            ).label;
    }

    selectedButton.style.borderColor = isCorrect ? "#4b9d94" : "#ee765b";

    lessonScore.textContent =
        `النتيجة: ${lessonCorrect} من ${lessonAttempts}`;

    lessonOptions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });

    const hasNextQuestion =
        currentQuestionIndex < currentLesson.questions.length - 1;
    const nextButton = document.createElement("button");

    nextButton.type = "button";
    nextButton.className = "btn btn-primary";
    nextButton.textContent = hasNextQuestion
        ? "السؤال التالي ←"
        : "أعد النشاط ↻";
    nextButton.addEventListener("click", () => {
        if (hasNextQuestion) {
            currentQuestionIndex++;
            renderLessonQuestion();
            return;
        }

        openLesson(currentLessonKey);
    });

    lessonOptions.appendChild(nextButton);
}

document.getElementById("closeLesson").addEventListener("click", () => {
    lessonPanel.classList.add("hidden");
    learningGrid.classList.remove("hidden");
});


// ==============================
// 3. Short stories
// ==============================

const storyData = {
    flower: {
        title: "السلحفاة والزهرة",
        paragraphs: [
            "وجدت سلحفاة صغيرة زهرة عطشى في الحديقة.",
            "أحضرت لها قليلًا من الماء كل صباح، فكبرت الزهرة وتفتحت.",
            "فرحت السلحفاة، وصارت تزور الزهرة لتشم رائحتها الجميلة."
        ],
        question: "كيف ساعدت السلحفاة الزهرة؟",
        options: [
            { label: "💧 سقتها بالماء", value: "water" },
            { label: "🙈 أخفتها", value: "hide" },
            { label: "🚶 ابتعدت عنها", value: "leave" }
        ],
        answer: "water"
    },
    toys: {
        title: "لينا وألعابها",
        paragraphs: [
            "لعبت لينا بالمكعبات والكرة مع أخيها الصغير.",
            "بعد اللعب، جمعت المكعبات في صندوقها ووضعت الكرة في مكانها.",
            "شكرت لينا أخاها لأنه ساعدها، ثم اختارا قصة يقرآنها معًا."
        ],
        question: "ماذا فعلت لينا بعد اللعب؟",
        options: [
            { label: "🧺 رتبت ألعابها", value: "tidy" },
            { label: "🌳 تركتها في الحديقة", value: "outside" },
            { label: "😴 نامت فورًا", value: "sleep" }
        ],
        answer: "tidy"
    },
    bird: {
        title: "عصفور يبحث عن صديق",
        paragraphs: [
            "طار عصفور صغير إلى الشجرة، لكنه لم يجد أحدًا ليلعب معه.",
            "رأى أرنبًا يحمل بذورًا ثقيلة، فعرض عليه المساعدة.",
            "شكرا له الأرنب، ولعبا معًا تحت الشجرة حتى المساء."
        ],
        question: "كيف أصبح العصفور والأرنب صديقين؟",
        options: [
            { label: "🤝 تعاونا وساعد أحدهما الآخر", value: "help" },
            { label: "😠 تشاجرا", value: "fight" },
            { label: "🌧️ اختبآ من المطر", value: "rain" }
        ],
        answer: "help"
    }
};

const storyGrid = document.getElementById("storyGrid");
const storyHeading = document.getElementById("storyHeading");
const storyReader = document.getElementById("storyReader");
const storyTitle = document.getElementById("storyTitle");
const storyText = document.getElementById("storyText");
const storyQuestion = document.getElementById("storyQuestion");
const storyOptions = document.getElementById("storyOptions");
const storyFeedback = document.getElementById("storyFeedback");
let currentStory = null;

document.querySelectorAll("[data-story]").forEach((button) => {
    button.addEventListener("click", () => openStory(button.dataset.story));
});

function openStory(key) {
    currentStory = storyData[key];

    if (!currentStory) return;

    storyTitle.textContent = currentStory.title;
    storyQuestion.textContent = currentStory.question;
    storyFeedback.textContent = "";
    storyText.replaceChildren();
    storyOptions.replaceChildren();

    currentStory.paragraphs.forEach((paragraphText) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = paragraphText;
        storyText.appendChild(paragraph);
    });

    currentStory.options.forEach((option) => {
        const button = document.createElement("button");

        button.className = "lesson-option";
        button.type = "button";
        button.textContent = option.label;
        button.addEventListener("click", () => answerStory(option, button));
        storyOptions.appendChild(button);
    });

    storyHeading.classList.add("hidden");
    storyGrid.classList.add("hidden");
    storyReader.classList.remove("hidden");
    storyReader.scrollIntoView({ behavior: "smooth", block: "start" });
}

function answerStory(selectedOption, selectedButton) {
    const isCorrect = selectedOption.value === currentStory.answer;
    const correctOption = currentStory.options.find(
        (option) => option.value === currentStory.answer
    );

    storyFeedback.textContent = isCorrect
        ? "إجابة رائعة! أحسنت 🌟"
        : `محاولة جميلة! الإجابة الصحيحة: ${correctOption.label}`;
    selectedButton.style.borderColor = isCorrect ? "#4b9d94" : "#ee765b";
    storyOptions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });
}

function closeStory() {
    storyReader.classList.add("hidden");
    storyHeading.classList.remove("hidden");
    storyGrid.classList.remove("hidden");
}

document.getElementById("closeStory").addEventListener("click", closeStory);
document.getElementById("storyListen").addEventListener("click", () => {
    if (!currentStory) return;

    speakText([currentStory.title, ...currentStory.paragraphs].join(". "));
});


// ==============================
// 3. Memory game
// ==============================

const memoryGrid = document.getElementById("memoryGrid");
const attemptsElement = document.getElementById("attempts");
const matchesElement = document.getElementById("matches");
const gameFeedback = document.getElementById("gameFeedback");
const restartGame = document.getElementById("restartGame");
const nextMemoryLevel = document.getElementById("nextMemoryLevel");
const memoryLevelElement = document.getElementById("memoryLevel");
const memoryTotalPairs = document.getElementById("memoryTotalPairs");
const gamePicker = document.getElementById("gamePicker");
const backToGames = document.getElementById("backToGames");

const symbols = ["🌻", "🦋", "🌈", "🐱", "🍎", "⭐"];
const memoryLevels = [3, 4, 6];
const memoryLevelNames = ["١", "٢", "٣"];
let memoryLevelIndex = 0;

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let attempts = 0;
let matches = 0;
let mismatchTimer = null;

document.querySelectorAll("[data-game]").forEach((button) => {
    button.addEventListener("click", () => {
        const selectedGame = button.dataset.game;

        document.querySelectorAll("[data-game]").forEach((gameButton) => {
            const isSelected = gameButton === button;

            gameButton.classList.toggle("is-selected", isSelected);
            gameButton.setAttribute("aria-pressed", String(isSelected));
        });

        document.querySelectorAll(".game-view").forEach((view) => {
            view.classList.toggle("hidden", view.id !== `${selectedGame}Game`);
        });

        gamePicker.classList.add("hidden");
        backToGames.classList.remove("hidden");
        trackGame("started", selectedGame);
    });
});

backToGames.addEventListener("click", () => {
    gamePicker.classList.remove("hidden");
    backToGames.classList.add("hidden");

    document.querySelectorAll(".game-view").forEach((view) => {
        view.classList.add("hidden");
    });

    document.querySelectorAll("[data-game]").forEach((button) => {
        button.classList.remove("is-selected");
        button.setAttribute("aria-pressed", "false");
    });

    gamePicker.scrollIntoView({ behavior: "smooth", block: "center" });
});

function shuffle(items) {
    for (let index = items.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    return items;
}

function setGameFeedback(element, message, state = "") {
    element.textContent = message;
    element.classList.toggle("is-success", state === "success");
    element.classList.toggle("is-error", state === "error");
}

function showGameRating(element, correct, total) {
    const percent = Math.round((correct / total) * 100);
    let level = "بداية موفقة، مستواك مبتدئ";

    if (percent >= 80) {
        level = "ممتاز! مستواك متقدم";
    } else if (percent >= 50) {
        level = "أحسنت! مستواك متوسط";
    }

    element.textContent = `تقييم المستوى: ${level} (${percent}٪)`;
    element.classList.remove("hidden");
}

function startMemoryGame() {
    clearTimeout(mismatchTimer);

    firstCard = null;
    secondCard = null;
    lockBoard = false;
    attempts = 0;
    matches = 0;

    attemptsElement.textContent = "0";
    matchesElement.textContent = "0";
    memoryLevelElement.textContent = memoryLevelNames[memoryLevelIndex];
    memoryTotalPairs.textContent = String(memoryLevels[memoryLevelIndex]);
    nextMemoryLevel.classList.add("hidden");
    restartGame.textContent = "إعادة اللعب ↻";
    document.getElementById("memoryRating").classList.add("hidden");
    setGameFeedback(gameFeedback, "اقلب بطاقة، ثم ابحث عن البطاقة المشابهة لها.");

    memoryGrid.replaceChildren();

    const activeSymbols = symbols.slice(0, memoryLevels[memoryLevelIndex]);
    const cards = shuffle([...activeSymbols, ...activeSymbols]);

    cards.forEach((symbol, index) => {
        const card = document.createElement("button");

        card.type = "button";
        card.className = "memory-card";
        card.textContent = "❔";
        card.dataset.symbol = symbol;
        card.dataset.index = String(index);
        card.setAttribute("aria-label", "بطاقة مخفية");

        card.addEventListener("click", () => flipCard(card));

        memoryGrid.appendChild(card);
    });
}

function flipCard(card) {
    if (
        lockBoard ||
        card === firstCard ||
        card.classList.contains("is-matched") ||
        card.classList.contains("is-open")
    ) {
        return;
    }

    card.textContent = card.dataset.symbol;
    card.classList.add("is-open");
    card.setAttribute("aria-label", `بطاقة ${card.dataset.symbol}`);

    if (!firstCard) {
        firstCard = card;
        setGameFeedback(gameFeedback, "اختار البطاقة المشابهة لها.");
        return;
    }

    secondCard = card;
    attempts++;

    attemptsElement.textContent = String(attempts);

    if (firstCard.dataset.symbol === secondCard.dataset.symbol) {
        firstCard.classList.add("is-matched");
        secondCard.classList.add("is-matched");
        firstCard.setAttribute("aria-label", `بطاقة ${firstCard.dataset.symbol}، تم العثور على الزوج`);
        secondCard.setAttribute("aria-label", `بطاقة ${secondCard.dataset.symbol}، تم العثور على الزوج`);

        firstCard.disabled = true;
        secondCard.disabled = true;

        matches++;
        matchesElement.textContent = String(matches);

        setGameFeedback(gameFeedback, "رائع! لقيت زوجًا متشابهًا 🎉", "success");

        resetTurn();

        if (matches === memoryLevels[memoryLevelIndex]) {
            showGameRating(
                document.getElementById("memoryRating"),
                matches,
                attempts
            );

            if (memoryLevelIndex < memoryLevels.length - 1) {
                setGameFeedback(
                    gameFeedback,
                    `أكملت المستوى ${memoryLevelNames[memoryLevelIndex]} في ${attempts} محاولات! 🎉`,
                    "success"
                );
                nextMemoryLevel.classList.remove("hidden");
            } else {
                trackGame("completed", "memory");
                setGameFeedback(
                    gameFeedback,
                    `أكملت كل المستويات في ${attempts} محاولات! بطل اللعبة 🏆`,
                    "success"
                );
                restartGame.textContent = "العب من جديد ↻";
            }
        }
    } else {
        lockBoard = true;
        firstCard.classList.add("is-mismatch");
        secondCard.classList.add("is-mismatch");
        setGameFeedback(gameFeedback, "مش متشابهين، جرّب بطاقتين غيرهما 💛", "error");

        mismatchTimer = setTimeout(() => {
            [firstCard, secondCard].forEach((mismatchedCard) => {
                mismatchedCard.textContent = "❔";
                mismatchedCard.classList.remove("is-open", "is-mismatch");
                mismatchedCard.setAttribute("aria-label", "بطاقة مخفية");
            });

            resetTurn();
            setGameFeedback(gameFeedback, "حاول مرة أخرى، أنت قريب! 💛");
        }, 850);
    }
}

function resetTurn() {
    firstCard = null;
    secondCard = null;
    lockBoard = false;
}

restartGame.addEventListener("click", () => {
    if (matches === memoryLevels[memoryLevelIndex] && memoryLevelIndex === memoryLevels.length - 1) {
        memoryLevelIndex = 0;
    }

    startMemoryGame();
});

nextMemoryLevel.addEventListener("click", () => {
    memoryLevelIndex++;
    startMemoryGame();
});

startMemoryGame();

const colorRounds = [
    {
        prompt: "اضغط على اللون الأحمر.",
        answer: "red",
        choices: [
            { label: "أحمر", color: "red", value: "red" },
            { label: "أزرق", color: "blue", value: "blue" },
            { label: "أخضر", color: "green", value: "green" }
        ]
    },
    {
        prompt: "اضغط على اللون الأصفر.",
        answer: "yellow",
        choices: [
            { label: "بنفسجي", color: "purple", value: "purple" },
            { label: "أصفر", color: "#f4c542", value: "yellow" },
            { label: "أزرق", color: "blue", value: "blue" }
        ]
    },
    {
        prompt: "اضغط على اللون الأخضر.",
        answer: "green",
        choices: [
            { label: "أحمر", color: "red", value: "red" },
            { label: "أخضر", color: "green", value: "green" },
            { label: "برتقالي", color: "#ee8d38", value: "orange" }
        ]
    }
];

const colorPrompt = document.getElementById("colorPrompt");
const colorOptions = document.getElementById("colorOptions");
const colorFeedback = document.getElementById("colorFeedback");
const colorScore = document.getElementById("colorScore");
const colorRound = document.getElementById("colorRound");
const colorRating = document.getElementById("colorRating");
const nextColorRound = document.getElementById("nextColorRound");
let colorRoundIndex = 0;
let colorCorrect = 0;
let colorAnswered = false;

function renderColorRound() {
    const round = colorRounds[colorRoundIndex];

    colorAnswered = false;
    colorPrompt.textContent = round.prompt;
    colorRound.textContent = `${colorRoundIndex + 1} / ${colorRounds.length}`;
    colorScore.textContent = `إجابات صحيحة: ${colorCorrect}`;
    setGameFeedback(colorFeedback, "اختار اللون المطلوب.");
    nextColorRound.classList.add("hidden");
    colorRating.classList.add("hidden");
    colorOptions.replaceChildren();

    round.choices.forEach((choice) => {
        const button = document.createElement("button");
        const swatch = document.createElement("span");

        button.type = "button";
        button.className = "color-option";
        button.setAttribute("aria-label", choice.label);
        swatch.className = "color-swatch";
        swatch.style.backgroundColor = choice.color;
        button.append(swatch, document.createTextNode(choice.label));
        button.addEventListener("click", () => answerColor(choice, button));
        colorOptions.appendChild(button);
    });
}

function answerColor(choice, selectedButton) {
    if (colorAnswered) return;

    colorAnswered = true;
    const isCorrect = choice.value === colorRounds[colorRoundIndex].answer;

    if (isCorrect) colorCorrect++;
    setGameFeedback(
        colorFeedback,
        isCorrect ? "إجابة صحيحة! أحسنت 🎉" : "محاولة جميلة، جرّب الجولة التالية 💛",
        isCorrect ? "success" : "error"
    );
    selectedButton.classList.add(isCorrect ? "is-correct" : "is-wrong");
    colorScore.textContent = `إجابات صحيحة: ${colorCorrect}`;
    colorOptions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });

    if (colorRoundIndex === colorRounds.length - 1) {
        showGameRating(colorRating, colorCorrect, colorRounds.length);
        trackGame("completed", "color");
    }

    nextColorRound.textContent = colorRoundIndex < colorRounds.length - 1
        ? "التالي ←"
        : "العب مرة أخرى ↻";
    nextColorRound.classList.remove("hidden");
}

nextColorRound.addEventListener("click", () => {
    if (colorRoundIndex < colorRounds.length - 1) {
        colorRoundIndex++;
    } else {
        colorRoundIndex = 0;
        colorCorrect = 0;
    }

    renderColorRound();
});

const patternRounds = [
    { sequence: ["🔴", "🔵", "🔴", "🔵"], answer: "🔴", options: ["🔴", "🟡", "🟢"] },
    { sequence: ["⭐", "⭐", "🌙", "⭐", "⭐"], answer: "🌙", options: ["⭐", "🌙", "☀️"] },
    { sequence: ["🟢", "🟡", "🔵", "🟢", "🟡"], answer: "🔵", options: ["🔴", "🔵", "🟡"] }
];

const patternSequence = document.getElementById("patternSequence");
const patternOptions = document.getElementById("patternOptions");
const patternFeedback = document.getElementById("patternFeedback");
const patternScore = document.getElementById("patternScore");
const patternRound = document.getElementById("patternRound");
const patternRating = document.getElementById("patternRating");
const nextPatternRound = document.getElementById("nextPatternRound");
let patternRoundIndex = 0;
let patternCorrect = 0;
let patternAnswered = false;

function renderPatternRound() {
    const round = patternRounds[patternRoundIndex];

    patternAnswered = false;
    patternSequence.textContent = `${round.sequence.join("　")}　❔`;
    patternSequence.setAttribute(
        "aria-label",
        `${round.sequence.join("، ")}، ما الرمز التالي؟`
    );
    patternRound.textContent = `${patternRoundIndex + 1} / ${patternRounds.length}`;
    patternScore.textContent = `إجابات صحيحة: ${patternCorrect}`;
    setGameFeedback(patternFeedback, "اضغط على الرمز الذي يكمل النمط.");
    nextPatternRound.classList.add("hidden");
    patternRating.classList.add("hidden");
    patternOptions.replaceChildren();

    round.options.forEach((symbol) => {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "pattern-option";
        button.textContent = symbol;
        button.setAttribute("aria-label", symbol);
        button.addEventListener("click", () => answerPattern(symbol, button));
        patternOptions.appendChild(button);
    });
}

function answerPattern(symbol, selectedButton) {
    if (patternAnswered) return;

    patternAnswered = true;
    const isCorrect = symbol === patternRounds[patternRoundIndex].answer;

    if (isCorrect) patternCorrect++;
    setGameFeedback(
        patternFeedback,
        isCorrect ? "ممتاز! عرفت النمط 🌟" : "قريب! راقب ترتيب الرموز وحاول مرة أخرى.",
        isCorrect ? "success" : "error"
    );
    selectedButton.classList.add(isCorrect ? "is-correct" : "is-wrong");
    patternScore.textContent = `إجابات صحيحة: ${patternCorrect}`;
    patternOptions.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });

    if (patternRoundIndex === patternRounds.length - 1) {
        showGameRating(patternRating, patternCorrect, patternRounds.length);
        trackGame("completed", "pattern");
    }

    nextPatternRound.textContent = patternRoundIndex < patternRounds.length - 1
        ? "التالي ←"
        : "العب مرة أخرى ↻";
    nextPatternRound.classList.remove("hidden");
}

nextPatternRound.addEventListener("click", () => {
    if (patternRoundIndex < patternRounds.length - 1) {
        patternRoundIndex++;
    } else {
        patternRoundIndex = 0;
        patternCorrect = 0;
    }

    renderPatternRound();
});

renderColorRound();
renderPatternRound();


// ==============================
// 4. Communication board
// ==============================

const sentenceOutput = document.getElementById("sentenceOutput");
const clearSentence = document.getElementById("clearSentence");
const speakSentence = document.getElementById("speakSentence");

let sentenceWords = [];

document.querySelectorAll(".communication-choice").forEach((button) => {
    button.addEventListener("click", () => {
        sentenceWords.push({
            word: button.dataset.word,
            emoji: button.dataset.emoji
        });

        updateSentence();
    });
});

function updateSentence() {
    if (sentenceWords.length === 0) {
        sentenceOutput.textContent = "اختار الكلمات من تحت";
        return;
    }

    sentenceOutput.textContent = sentenceWords
        .map((item) => `${item.emoji} ${item.word}`)
        .join(" + ");
}

clearSentence.addEventListener("click", () => {
    sentenceWords = [];
    updateSentence();
});

speakSentence.addEventListener("click", () => {
    if (sentenceWords.length === 0) {
        sentenceOutput.textContent = "اختار كلمة واحدة على الأقل 💛";
        return;
    }

    if (!("speechSynthesis" in window)) {
        sentenceOutput.textContent =
            "خاصية الصوت غير متاحة في المتصفح ده.";
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
        sentenceWords.map((item) => item.word).join(" ")
    );

    utterance.lang = "ar-EG";
    utterance.rate = 0.85;

    window.speechSynthesis.speak(utterance);
});


// ==============================
// 5. Accounts, activity, and support
// ==============================

const contactForm = document.getElementById("contactForm");
const contactFeedback = document.getElementById("contactFeedback");
const parentAuth = document.getElementById("parentAuth");
const parentDashboard = document.getElementById("parentDashboard");
const parentAuthFeedback = document.getElementById("parentAuthFeedback");
const specialistAuth = document.getElementById("specialistAuth");
const specialistDashboard = document.getElementById("specialistDashboard");
const specialistAuthFeedback = document.getElementById("specialistAuthFeedback");
const gameChildWrapper = document.getElementById("gameChildWrapper");
const gameChildSelect = document.getElementById("gameChildSelect");
const API_BASE = ["3000", "5500"].includes(window.location.port)
    ? "http://127.0.0.1:8000"
    : "";
let currentUser = null;
let selectedChildId = null;

async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...options.headers
        }
    });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "تعذر إكمال الطلب.");
    }

    return data;
}

function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
}

function setFeedback(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("is-error", isError);
}

function showParentAuth(isAuthenticated) {
    parentAuth.classList.toggle("hidden", isAuthenticated);
    parentDashboard.classList.toggle("hidden", !isAuthenticated);
    gameChildWrapper.classList.toggle("hidden", !isAuthenticated || !currentUser.children?.length);
    if (isAuthenticated) {
        document.getElementById("parentDisplayName").textContent = currentUser.name;
        fillChildSelect(currentUser.children);
    }
}

function fillChildSelect(children) {
    gameChildSelect.replaceChildren();
    children.forEach((child) => {
        const option = document.createElement("option");
        option.value = child.id;
        option.textContent = child.name;
        gameChildSelect.appendChild(option);
    });
    selectedChildId = children[0]?.id || null;
}

gameChildSelect.addEventListener("change", () => {
    selectedChildId = Number(gameChildSelect.value) || null;
});

async function trackGame(eventType, game) {
    if (currentUser?.role !== "parent" || !selectedChildId) return;

    try {
        await apiRequest("/api/activity", {
            method: "POST",
            body: JSON.stringify({ event: eventType, game, child_id: selectedChildId })
        });
        if (eventType === "completed") await loadParentDashboard();
    } catch (error) {
        console.warn("تعذر حفظ نشاط الطفل:", error.message);
    }
}

function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-EG");
}

function eventLabel(event) {
    const labels = {
        parent_login: "تسجيل دخول وليّ الأمر",
        specialist_login: "تسجيل دخول مختص",
        game_started: "بدأ اللعب",
        game_completed: "أكمل اللعبة"
    };
    const gameNames = { memory: "طابق البطاقات", color: "صيّاد الألوان", pattern: "أكمل النمط" };
    return `${labels[event.event_type] || event.event_type}${event.game ? `: ${gameNames[event.game] || event.game}` : ""}`;
}

function appendActivityList(target, events, emptyText) {
    target.replaceChildren();
    if (!events.length) {
        target.textContent = emptyText;
        return;
    }

    events.forEach((event) => {
        const item = document.createElement("div");
        const title = document.createElement("strong");
        const date = document.createElement("small");
        title.textContent = `${event.child_name ? `${event.child_name}: ` : ""}${eventLabel(event)}`;
        date.textContent = formatDate(event.created_at);
        item.className = "activity-item";
        item.append(title, date);
        target.appendChild(item);
    });
}

function appendNotifications(target, notifications) {
    target.replaceChildren();
    if (!notifications.length) {
        target.textContent = "لا توجد تنبيهات جديدة.";
        return;
    }

    notifications.forEach((notification) => {
        const item = document.createElement("div");
        const message = document.createElement("strong");
        const date = document.createElement("small");
        item.className = "notification-item";
        message.textContent = notification.message;
        date.textContent = `${notification.event_type} · ${formatDate(notification.created_at)}`;
        item.append(message, date);
        target.appendChild(item);
    });
}

function appendTicketList(target, tickets, allowReply) {
    target.replaceChildren();
    if (!tickets.length) {
        target.textContent = "لا توجد طلبات مساعدة بعد.";
        return;
    }

    tickets.forEach((ticket) => {
        const item = document.createElement("article");
        const heading = document.createElement("h5");
        const meta = document.createElement("small");
        const messages = document.createElement("div");
        item.className = "ticket-item";
        heading.textContent = `#${ticket.id} · ${ticket.subject}`;
        meta.textContent = `${ticket.contact_name} · ${ticket.contact_email} · ${ticket.status === "answered" ? "تم الرد" : "بانتظار الرد"} · ${formatDate(ticket.created_at)}`;
        item.append(heading, meta, messages);

        ticket.messages.forEach((message) => {
            const line = document.createElement("p");
            line.className = `ticket-message${message.sender_role === "specialist" ? " is-reply" : ""}`;
            line.textContent = `${message.sender_name || (message.sender_role === "specialist" ? "المختص" : ticket.contact_name)}: ${message.message}`;
            messages.appendChild(line);
        });

        if (allowReply) {
            const form = document.createElement("form");
            const textarea = document.createElement("textarea");
            const button = document.createElement("button");
            form.className = "reply-form";
            textarea.name = "message";
            textarea.rows = 2;
            textarea.maxLength = 4000;
            textarea.placeholder = "اكتب ردًا للأسرة";
            textarea.required = true;
            button.type = "submit";
            button.className = "btn btn-primary";
            button.textContent = "إرسال الرد";
            form.append(textarea, button);
            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                button.disabled = true;
                try {
                    await apiRequest(`/api/support/${ticket.id}/reply`, {
                        method: "POST",
                        body: JSON.stringify({ message: textarea.value })
                    });
                    await loadSpecialistDashboard();
                } catch (error) {
                    setFeedback(document.getElementById("specialistDashboardFeedback"), error.message, true);
                    button.disabled = false;
                }
            });
            item.appendChild(form);
        }

        target.appendChild(item);
    });
}

async function loadParentDashboard() {
    const data = await apiRequest("/api/parent/dashboard");
    currentUser = data.user;
    showParentAuth(true);

    const childrenList = document.getElementById("childrenList");
    childrenList.replaceChildren();
    currentUser.children.forEach((child) => {
        const row = document.createElement("div");
        const name = document.createElement("strong");
        const age = document.createElement("small");
        row.className = "child-row";
        name.textContent = child.name;
        age.textContent = child.age ? `العمر: ${child.age}` : "";
        row.append(name, age);
        childrenList.appendChild(row);
    });
    appendActivityList(
        document.getElementById("parentActivityList"),
        data.events,
        "ستظهر هنا الألعاب التي يبدأها طفلك ونتائجه."
    );
    appendTicketList(document.getElementById("parentTicketList"), data.tickets, false);
}

async function loadSpecialistDashboard() {
    const data = await apiRequest("/api/specialist/dashboard");
    document.getElementById("specialistDisplayName").textContent = currentUser.name;
    appendActivityList(
        document.getElementById("specialistEventList"),
        data.events,
        "لا توجد أنشطة مسجلة بعد."
    );
    appendNotifications(
        document.getElementById("specialistNotificationList"),
        data.notifications
    );
    appendTicketList(document.getElementById("specialistTicketList"), data.tickets, true);
}

function showCurrentAccount() {
    const parentIsLoggedIn = currentUser?.role === "parent";
    const specialistIsLoggedIn = currentUser?.role === "specialist";
    showParentAuth(parentIsLoggedIn);
    specialistAuth.classList.toggle("hidden", specialistIsLoggedIn);
    specialistDashboard.classList.toggle("hidden", !specialistIsLoggedIn);
    if (specialistIsLoggedIn) {
        loadSpecialistDashboard().catch((error) => {
            setFeedback(document.getElementById("specialistDashboardFeedback"), error.message, true);
        });
    }
    if (parentIsLoggedIn) {
        loadParentDashboard().catch((error) => {
            setFeedback(document.getElementById("parentDashboardFeedback"), error.message, true);
        });
    }
}

async function refreshSession() {
    try {
        const data = await apiRequest("/api/session");
        currentUser = data.user;
        showCurrentAccount();
    } catch (error) {
        console.warn("تعذر التحقق من الجلسة:", error.message);
    }
}

document.getElementById("showLogin").addEventListener("click", () => {
    document.getElementById("parentLoginForm").classList.remove("hidden");
    document.getElementById("parentRegisterForm").classList.add("hidden");
    document.getElementById("showLogin").classList.add("is-active");
    document.getElementById("showLogin").setAttribute("aria-pressed", "true");
    document.getElementById("showRegister").classList.remove("is-active");
    document.getElementById("showRegister").setAttribute("aria-pressed", "false");
});

document.getElementById("showRegister").addEventListener("click", () => {
    document.getElementById("parentLoginForm").classList.add("hidden");
    document.getElementById("parentRegisterForm").classList.remove("hidden");
    document.getElementById("showRegister").classList.add("is-active");
    document.getElementById("showRegister").setAttribute("aria-pressed", "true");
    document.getElementById("showLogin").classList.remove("is-active");
    document.getElementById("showLogin").setAttribute("aria-pressed", "false");
});

document.getElementById("parentLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify(formValues(event.currentTarget))
        });
        if (data.user.role !== "parent") {
            await apiRequest("/api/logout", { method: "POST", body: "{}" });
            throw new Error("هذا الحساب ليس حساب وليّ أمر.");
        }
        currentUser = data.user;
        showCurrentAccount();
        navigateTo("account");
    } catch (error) {
        setFeedback(parentAuthFeedback, error.message, true);
    }
});

document.getElementById("parentRegisterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    values.consent = event.currentTarget.elements.consent.checked;
    try {
        const data = await apiRequest("/api/register/parent", {
            method: "POST",
            body: JSON.stringify(values)
        });
        currentUser = data.user;
        showCurrentAccount();
        navigateTo("account");
        setFeedback(document.getElementById("parentDashboardFeedback"), "تم إنشاء الحساب. أضف اختيار ملف الطفل في الألعاب لتسجيل نشاطه.");
    } catch (error) {
        setFeedback(parentAuthFeedback, error.message, true);
    }
});

document.getElementById("addChildForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await apiRequest("/api/children", {
            method: "POST",
            body: JSON.stringify(formValues(event.currentTarget))
        });
        event.currentTarget.reset();
        await loadParentDashboard();
    } catch (error) {
        setFeedback(document.getElementById("parentDashboardFeedback"), error.message, true);
    }
});

document.getElementById("specialistLoginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const data = await apiRequest("/api/login", {
            method: "POST",
            body: JSON.stringify(formValues(event.currentTarget))
        });
        if (data.user.role !== "specialist") {
            await apiRequest("/api/logout", { method: "POST", body: "{}" });
            throw new Error("هذا الحساب ليس حساب مختص.");
        }
        currentUser = data.user;
        showCurrentAccount();
    } catch (error) {
        setFeedback(specialistAuthFeedback, error.message, true);
    }
});

document.getElementById("specialistRegisterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const data = await apiRequest("/api/register/specialist", {
            method: "POST",
            body: JSON.stringify(formValues(event.currentTarget))
        });
        currentUser = data.user;
        showCurrentAccount();
    } catch (error) {
        setFeedback(specialistAuthFeedback, error.message, true);
    }
});

document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
        try {
            await apiRequest("/api/logout", { method: "POST", body: "{}" });
            currentUser = null;
            selectedChildId = null;
            showCurrentAccount();
            navigateTo("home");
        } catch (error) {
            setFeedback(parentDashboardFeedback, error.message, true);
        }
    });
});

contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    try {
        const data = await apiRequest("/api/support", {
            method: "POST",
            body: JSON.stringify(values)
        });
        setFeedback(contactFeedback, `تم حفظ طلبك برقم #${data.ticket_id}. سنرد على بريدك الإلكتروني، ويمكن لوليّ الأمر متابعة الرد من حسابه.`);
        contactForm.reset();
        if (currentUser?.role === "parent") await loadParentDashboard();
    } catch (error) {
        setFeedback(contactFeedback, error.message, true);
    }
});

refreshSession();

// ==============================
// 6. Language toggle
// ==============================

const languageBtn = document.getElementById("languageBtn");

let currentLanguage = "ar";

const translations = {
    ar: {
        title: "Together | معًا",
        home: "الرئيسية",
        about: "عن المنصة",
        learning: "التعلّم",
        stories: "القصص",
        games: "الألعاب",
        communication: "التواصل",
        family: "للأسرة",
        account: "حساب وليّ الأمر",
        specialists: "للمختصين",
        contact: "الدعم",
        eyebrow: "🌈 كل خطوة صغيرة تصنع فرقًا",
        heroTitle: "نتعلّم ونلعب<br><span>ونتواصل معًا</span>",
        description:
            "مساحة آمنة وممتعة تساعد الأشخاص ذوي متلازمة داون على التعلّم والتعبير عن أنفسهم، وتدعم أسرهم والمتخصصين في رحلة النمو والتطوّر.",
        start: "ابدأ التعلّم ✨",
        discover: "اكتشف المنصة",
        stats1: "تعلّم ممتع",
        stats2: "أنشطة تفاعلية",
        stats3: "دعم للجميع"
    },

    en: {
        title: "Together | Together",
        home: "Home",
        about: "About",
        learning: "Learning",
        stories: "Stories",
        games: "Games",
        communication: "Communication",
        family: "For Families",
        account: "Parent Account",
        specialists: "For Specialists",
        contact: "Support",
        eyebrow: "🌈 Every small step makes a difference",
        heroTitle: "We learn and play<br><span>and communicate together</span>",
        description:
            "A safe, engaging space that supports people with Down syndrome in learning and self-expression, while supporting families and specialists throughout the journey.",
        start: "Start Learning ✨",
        discover: "Discover Together",
        stats1: "Fun Learning",
        stats2: "Interactive Activities",
        stats3: "Support for Everyone"
    }
};

function setLanguage(language) {
    const t = translations[language];

    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title = t.title;

    const navLinks = document.querySelectorAll(".nav-link");

    const navKeys = [
        "home",
        "about",
        "learning",
        "stories",
        "games",
        "communication",
        "family",
        "account",
        "specialists",
        "contact"
    ];

    navLinks.forEach((link, index) => {
        link.textContent = t[navKeys[index]];
    });

    document.querySelector(".hero .eyebrow").textContent = t.eyebrow;
    document.querySelector(".hero h1").innerHTML = t.heroTitle;
    document.querySelector(".hero-description").textContent = t.description;

    const heroButtons = document.querySelectorAll(".hero-actions .btn");
    heroButtons[0].textContent = t.start;
    heroButtons[1].textContent = t.discover;

    const stats = document.querySelectorAll(".hero-stats span");
    stats[0].textContent = t.stats1;
    stats[1].textContent = t.stats2;
    stats[2].textContent = t.stats3;

    languageBtn.textContent = language === "ar" ? "English" : "العربية";
}

languageBtn.addEventListener("click", () => {
    currentLanguage = currentLanguage === "ar" ? "en" : "ar";
    setLanguage(currentLanguage);
});


// ==============================
// 7. Current year
// ==============================

document.getElementById("currentYear").textContent =
    new Date().getFullYear();

showPage(window.location.hash.slice(1) || "home");
