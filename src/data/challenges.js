export const roomConfig = {
  title: "חדר בריחה",
  subtitle: "",
  finalPrompt: "הקלידו את הקוד שנוצר מכל החלקים שאספתם בדרך.",
  defaultSuccessMessage: "פתרתם את השלב וקיבלתם חלק מהקוד הסופי:",
  defaultErrorMessage: "הקוד הזה לא פתח את השלב. בדקו את הרמז ונסו שוב.",
  finalErrorMessage: "אפשר לכתוב את הקוד עם רווח או בלי רווח. בדקו את החלקים ונסו שוב.",
  finalSuccessEyebrow: "הבריחה הושלמה",
  finalSuccessTitle: "חופשה נעימה!",
  finalSuccessMessage: "כל הכבוד, פתחתם את הקוד הסופי.",
  finalSuccessButtonLabel: "חזרה לשלבים",
  questionPoints: 10,
  finalBonusPoints: 50,
};

export const challenges = [
  {
    id: 1,
    path: "/q/1",
    title: "קוד 1",
    question: "",
    reward: "חו",
    successMessage: "",
    errorMessage: "",
  },
  {
    id: 2,
    path: "/q/2",
    title: "קוד 2",
    question: "",
    reward: "פ",
    successMessage: "",
    errorMessage: "",
  },
  {
    id: 3,
    path: "/q/3",
    title: "קוד 3",
    question: "",
    reward: "שה",
    successMessage: "",
    errorMessage: "",
  },
  {
    id: 4,
    path: "/q/4",
    title: "קוד 4",
    question: "",
    reward: "נע",
    successMessage: "",
    errorMessage: "",
  },
  {
    id: 5,
    path: "/q/5",
    title: "קוד 5",
    question: "",
    reward: "ימה",
    successMessage: "",
    errorMessage: "",
  },
];

export const defaultPublicGameConfig = {
  roomConfig,
  challenges,
};
