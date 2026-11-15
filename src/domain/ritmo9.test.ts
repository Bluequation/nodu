import { describe, expect, it } from "vitest";
import {
  answerIsCorrect, calculateTopicPerformance, normalizeAnswer, subjectForArea,
} from "./ritmo9";
import type { QuestionAttemptRecord } from "./ritmo9";

describe("Ritmo 9 question answers", () => {
  it("normalizes case, accents and trailing punctuation", () => {
    expect(normalizeAnswer("  Física. ")).toBe("fisica");
    expect(answerIsCorrect("b)", "B")).toBe(true);
  });

  it("does not treat an empty answer as correct", () => {
    expect(answerIsCorrect("", "")).toBe(false);
    expect(answerIsCorrect("A", "B")).toBe(false);
  });

  it("maps study areas without pretending every subject is Physics or TAE", () => {
    expect(subjectForArea("Física")).toBe("fisica");
    expect(subjectForArea("Conhecimentos gerais")).toBe("general");
  });
});

describe("Ritmo 9 topic performance", () => {
  it("calculates accuracy from individual attempts and keeps topics separate", () => {
    const attempts: QuestionAttemptRecord[] = [
      { id: "1", questionId: "q1", answeredAt: 1, selectedAnswer: "A", isCorrect: true, mode: "practice", topicLinks: [{ planId: "p1", nodeId: "n1" }] },
      { id: "2", questionId: "q2", answeredAt: 2, selectedAnswer: "B", isCorrect: false, mode: "practice", topicLinks: [{ planId: "p1", nodeId: "n1" }] },
      { id: "3", questionId: "q3", answeredAt: 3, selectedAnswer: "C", isCorrect: true, mode: "practice", topicLinks: [{ planId: "p1", nodeId: "n2" }] },
    ];
    expect(calculateTopicPerformance(attempts)).toEqual([
      { key: "p1:n1", planId: "p1", nodeId: "n1", attempts: 2, correct: 1, accuracy: 50 },
      { key: "p1:n2", planId: "p1", nodeId: "n2", attempts: 1, correct: 1, accuracy: 100 },
    ]);
  });

  it("does not double count duplicate topic relations inside one attempt", () => {
    const attempt: QuestionAttemptRecord = {
      id: "1", questionId: "q1", answeredAt: 1, selectedAnswer: "A", isCorrect: true,
      mode: "practice",
      topicLinks: [{ planId: "p1", nodeId: "n1" }, { planId: "p1", nodeId: "n1" }],
    };
    expect(calculateTopicPerformance([attempt])[0].attempts).toBe(1);
  });
});
