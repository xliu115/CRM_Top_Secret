# Concierge Intelligence: Drafting & Bolding Logic

This document outlines the rules for generating conversational outreach nudges within the "The Digital Concierge" platform. The goal is to create "high-signal" summaries that anchor on specific contact activity while highlighting the most actionable data points.

## 1. Content Drafting Strategy
The summary follows a **[Hook] + [Context] + [Actionable Insight]** structure:

*   **The Hook:** Start with a recent, verifiable event (e.g., "Lisa recently shared an article...").
*   **The Context:** Provide a relationship health check (e.g., "She hasn't heard from you in 14 days...").
*   **The Actionable Insight:** Conclude with a specific, time-sensitive recommendation (e.g., "This is the optimal window to re-engage...").

## 2. Bolding Rules (Semantic Weight)
Bolding is used to guide the user's eye toward "anchors" and "trigger points."

| Element Type | Bolding Rule | Example |
| :--- | :--- | :--- |
| **Contact Activity** | Always bold the specific topic, article title, or company name associated with the contact's recent move. | **Sustainable Supply Chains** |
| **Relationship Gap** | Bold the duration if it exceeds a "warmth threshold" (e.g., > 10 days). | **14 days** |
| **Best Time to Reach Out** | Bold specific days or times derived from historical response data. | **Tuesday mornings** |
| **Strategic Milestone** | Bold the specific reason for the outreach (promotion, board seat, funding). | **recent board appointment** |

## 3. Conversational Tone Guidelines
*   **Avoid:** "Contact Lisa because she posted on LinkedIn."
*   **Use:** "Lisa is clearly monitoring your updates while her internal team structure is in flux. A casual inquiry would feel both timely and empathetic."
*   **Anchor:** Use the contact's first name to maintain a personal, concierge-like feel.

## 4. Drafting Template for LLMs
```markdown
[First Name] recently [Action] about [**Topic/Entity**].
[He/She] hasn't heard from you in [**Number of Days**],
and usually responds best on [**Day/Time**].
This is the optimal window to re-engage with a
[Type of Note] on [his/her] [**Recent Milestone**].
```
