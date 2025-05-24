import { generateText } from "ai";
import { google } from "@ai-sdk/google";

import { db } from "@/firebase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, role, level, techstack, amount, userid } = body;

    // Validate required fields
    if (!type || !role || !level || !techstack || !amount || !userid) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate interview type
    const validTypes = ["Technical", "Behavioral", "Mixed"];
    if (!validTypes.includes(type)) {
      return Response.json(
        { success: false, error: "Invalid interview type" },
        { status: 400 }
      );
    }

    // Validate level
    const validLevels = ["Junior", "Mid-Level", "Senior"];
    if (!validLevels.includes(level)) {
      return Response.json(
        { success: false, error: "Invalid experience level" },
        { status: 400 }
      );
    }

    const { text: questions } = await generateText({
      model: google("gemini-2.0-flash-001"),
      prompt: `Generate realistic interview questions that will help candidates practice and prepare effectively.

Interview Parameters:
- Role: ${role}
- Level: ${level}
- Tech Stack: ${techstack}
- Interview Type: ${type}
- Number of Questions: ${amount}

Question Guidelines:
1. Level-Specific Focus:
   - Junior: Core concepts and basic implementations
   - Mid-Level: Architecture and optimization
   - Senior: System design and leadership

2. Question Types:
   - Technical: Real coding scenarios and practical problems
   - Behavioral: Real workplace situations
   - Mixed: Combined technical and soft skills

3. Tech Stack Coverage:
   - Include questions about ${techstack}
   - Focus on practical usage
   - Cover common challenges

Format Requirements:
- Return as JSON array: ["Question 1", "Question 2", "Question 3"]
- Keep questions clear and concise
- Avoid special characters that affect voice synthesis

Note: These questions will be used in a practice interview to help candidates prepare.`,
    });

    // Validate generated questions
    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(questions);
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("Questions must be an array");
      }
    } catch (error) {
      return Response.json(
        { success: false, error: "Invalid questions format" },
        { status: 500 }
      );
    }

    const interview = {
      role: role,
      type: type,
      level: level,
      techstack: techstack.split(",").map((tech: string) => tech.trim()).filter(Boolean),
      questions: parsedQuestions,
      userId: userid,
      finalized: true,
      createdAt: new Date().toISOString(),
    };

    // Save the interview to the database
    const docRef = await db.collection("interviews").add(interview);

    return Response.json({ 
      success: true, 
      interviewId: docRef.id 
    }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return Response.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json(
    { success: true, message: "Interview generation API is running" },
    { status: 200 }
  );
}
