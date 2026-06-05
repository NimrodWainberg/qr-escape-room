export const roomConfig = {
  title: "מסע הקודים",
  subtitle: "סרקו QR, פתרו קוד קצר, ואספו חלק מהסיסמה הסופית.",
  finalPrompt: "הקלידו את הקוד שנוצר מכל החלקים שאספתם בדרך.",
};

export const challenges = [
  {
    id: 1,
    path: "/q/1",
    title: "קוד 1",
    question: "",
    reward: "חו",
  },
  {
    id: 2,
    path: "/q/2",
    title: "קוד 2",
    question: "",
    reward: "פ",
  },
  {
    id: 3,
    path: "/q/3",
    title: "קוד 3",
    question: "",
    reward: "שה",
  },
  {
    id: 4,
    path: "/q/4",
    title: "קוד 4",
    question: "",
    reward: "נע",
  },
  {
    id: 5,
    path: "/q/5",
    title: "קוד 5",
    question: "",
    reward: "ימה",
  },
];

export const defaultPublicGameConfig = {
  roomConfig,
  challenges,
};
