import "./globals.css";

export const metadata = {
  title: "Resume Classifier — AI-Powered Job Category Prediction",
  description:
    "Paste your resume text and let our fine-tuned DistilBERT model predict the best-matching job category out of 24 industries with confidence scores.",
  keywords: ["resume classifier", "AI", "job category", "DistilBERT", "NLP"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
