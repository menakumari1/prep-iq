"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    const formattedTranscript = transcript
      .map(
        (sentence: { role: string; content: string }) =>
          `- ${sentence.role}: ${sentence.content}\n`
      )
      .join("");

    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", {
        structuredOutputs: false,
      }),
      schema: feedbackSchema,
      prompt: `As an experienced interviewer, provide constructive feedback on this practice interview to help the candidate improve.

Interview Transcript:
${formattedTranscript}

Evaluation Areas:

1. Communication Skills (0-100):
   - Clear expression of ideas
   - Answer structure
   - Active listening
   - Professional tone
   - Non-verbal cues

2. Technical Knowledge (0-100):
   - Core concepts understanding
   - Practical application
   - Problem-solving approach
   - Technical vocabulary
   - Best practices awareness

3. Problem-Solving (0-100):
   - Analytical thinking
   - Solution approach
   - Edge cases consideration
   - Optimization thinking
   - Debugging strategy

4. Cultural Fit (0-100):
   - Team collaboration
   - Work style
   - Learning attitude
   - Adaptability
   - Initiative

5. Interview Presence (0-100):
   - Confidence
   - Question understanding
   - Response quality
   - Stress handling
   - Overall demeanor

Feedback Guidelines:
- Provide specific examples from their responses
- Highlight strengths with clear examples
- Give actionable improvement suggestions
- Keep feedback constructive and encouraging
- Focus on practical next steps

Remember this is practice feedback to help them improve for real interviews.`,
      system:
        "You are an experienced interviewer providing constructive feedback to help candidates improve their interview performance.",
    });

    const feedback = {
      interviewId: interviewId,
      userId: userId,
      totalScore: object.totalScore,
      categoryScores: object.categoryScores,
      strengths: object.strengths,
      areasForImprovement: object.areasForImprovement,
      finalAssessment: object.finalAssessment,
      createdAt: new Date().toISOString(),
    };

    let feedbackRef;

    if (feedbackId) {
      feedbackRef = db.collection("feedback").doc(feedbackId);
    } else {
      feedbackRef = db.collection("feedback").doc();
    }

    await feedbackRef.set(feedback);

    return { success: true, feedbackId: feedbackRef.id };
  } catch (error) {
    console.error("Error saving feedback:", error);
    return { success: false };
  }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
  const interview = await db.collection("interviews").doc(id).get();

  return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
  params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
  const { interviewId, userId } = params;

  const querySnapshot = await db
    .collection("feedback")
    .where("interviewId", "==", interviewId)
    .where("userId", "==", userId)
    .limit(1)
    .get();

  if (querySnapshot.empty) return null;

  const feedbackDoc = querySnapshot.docs[0];
  return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
  params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
  const { userId, limit = 20 } = params;

  const interviews = await db
    .collection("interviews")
    .orderBy("createdAt", "desc")
    .where("finalized", "==", true)
    .where("userId", "!=", userId)
    .limit(limit)
    .get();

  return interviews.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Interview[];
}

export async function getInterviewsByUserId(
  userId: string
): Promise<Interview[] | null> {
  try {
    const interviews = await db
      .collection("interviews")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const interviewsWithFeedback = await Promise.all(
      interviews.docs.map(async (doc) => {
        const interview = { id: doc.id, ...doc.data() } as Interview;
        
        // Get feedback for this interview
        const feedbackSnapshot = await db
          .collection("feedback")
          .where("interviewId", "==", doc.id)
          .where("userId", "==", userId)
          .limit(1)
          .get();

        const feedback = !feedbackSnapshot.empty
          ? feedbackSnapshot.docs[0].data()
          : null;

        return {
          ...interview,
          feedback: feedback
            ? {
                totalScore: feedback.totalScore,
                finalAssessment: feedback.finalAssessment,
                createdAt: feedback.createdAt,
              }
            : undefined,
        };
      })
    );

    return interviewsWithFeedback;
  } catch (error) {
    console.error("Error fetching interviews:", error);
    return null;
  }
}
