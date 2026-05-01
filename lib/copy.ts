// Hand-written, varied chat copy. NEVER AI-generated.
// Add more lines anytime. Picks are random — Joe sees something fresh each time.

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const greetings = [
  "Cha-ching 💸 — what'd you sell?",
  "Ready when you are.",
  "Big day? Let's log it.",
  "Drop a payment screenshot or just tell me about the sale.",
  "What's the move? Type it or drop a screenshot.",
  "Let's get this one in the books.",
  "Talk to me. What sold?",
];

const screenshotAcknowledged = [
  "Got it 👀 — reading it now…",
  "Nice. One sec…",
  "Looking at this…",
  "Lemme see…",
];

const askWatch = [
  "What's the watch? Brand and model.",
  "Now the fun part — what'd they buy?",
  "Tell me the watch. Brand, model, ref if you've got it.",
  "What did you ship out?",
];

const askCustomer = [
  "Who bought it? Name and email.",
  "Customer info — name + email.",
  "Who's getting this one?",
];

const askPayment = [
  "How much did they pay?",
  "Drop the amount.",
  "What'd they Zelle / wire over?",
];

const askMethod = [
  "Zelle, wire, or something else?",
  "How'd they pay?",
];

const askSeller = [
  "Who closed it — you or Jacob?",
  "Whose sale is this?",
];

const confirms = [
  "Looks good?",
  "All set — hit save?",
  "Ready to lock it in?",
  "Good to go?",
];

const saved = [
  "Boom — saved 🎉",
  "Another one for the books 📒",
  "Locked in. Receipt is yours.",
  "💸 In the books.",
  "That's a wrap.",
  "Big one. Saved.",
];

const errors = [
  "Hmm, couldn't read that — try a clearer one?",
  "Let me try that again — give me a second.",
  "No worries, just type it in below.",
];

const milestones = {
  bestMonthEver: [
    "🏆 Best month ever — keep it rolling.",
    "🏆 You just topped your highest month.",
  ],
  streak: (n: number) => [
    `🔥 ${n}-day streak`,
    `🔥 ${n} days in a row — let's go.`,
  ],
};

export const copy = {
  greeting: () => pick(greetings),
  screenshotAck: () => pick(screenshotAcknowledged),
  askWatch: () => pick(askWatch),
  askCustomer: () => pick(askCustomer),
  askPayment: () => pick(askPayment),
  askMethod: () => pick(askMethod),
  askSeller: () => pick(askSeller),
  confirm: () => pick(confirms),
  saved: () => pick(saved),
  error: () => pick(errors),
  bestMonth: () => pick(milestones.bestMonthEver),
  streak: (n: number) => pick(milestones.streak(n)),
};
