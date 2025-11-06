# ✨ Refine Session Note with AI Feature

## Overview

New feature that allows users to provide feedback and have OpenAI refine existing session notes based on their specific requests.

---

## 🎯 What It Does

**Different from Edit Button:**
- **Edit Button**: Manual editing of session fields (date, duration, location, note text, etc.)
- **Refine with AI Button**: AI-powered modification based on natural language feedback

**User Flow:**
1. Click "Refine with AI" button (lightbulb icon) on any session card
2. Modal opens showing:
   - Current session note (read-only)
   - Feedback textarea
   - Session context (client, duration, location, objectives)
3. User provides feedback like:
   - "Add more detail about the client's anxiety coping strategies"
   - "Make the activities section more specific with time breakdowns"
   - "Emphasize the client's progress in building self-esteem"
4. AI refines the note based on feedback + session context
5. Refined note is automatically saved

---

## 🚀 Files Added/Modified

### **New Files**

#### `src/app/api/openai/refine/route.ts` (NEW)
- API route for AI refinement
- Accepts: current note + feedback + session context
- Returns: refined note with all sections preserved

**Key Features:**
- Maintains original note structure
- Applies HIPAA compliance filters
- Uses peer support language exclusively
- Integrates session context (client name, objectives, treatment plan)

---

### **Modified Files**

#### `src/components/ui/SessionCard.tsx`
**Changes:**
1. Added `onRefine` prop to interface
2. Added `treatmentPlan` field to session data
3. Added "Refine with AI" button (lightbulb icon)
4. Button position: First in action buttons (before Edit/Delete)
5. Hidden for archived sessions

**Visual:**
```
[💡 Refine] [✏️ Edit] [🗑️ Archive] [📥 Export]
   Purple     Yellow      Red         Blue
```

#### `src/app/dashboard/history/page.tsx`
**Changes:**
1. Added refinement state:
   - `refiningSession` - session being refined
   - `showRefineModal` - modal visibility
   - `refineFeedback` - user feedback text
   - `refineLoading` - loading state
   - `refineError` - error messages

2. Added handlers:
   - `openRefineModal()` - opens modal with session
   - `closeRefineModal()` - closes and clears state
   - `handleRefineSubmit()` - processes refinement
   - `formatDate()` - helper for date formatting

3. Added "Refine with AI Modal" with:
   - Current note display (scrollable, read-only)
   - Feedback textarea with helpful placeholder
   - Session context display
   - Loading spinner during AI processing
   - Error handling

4. Updated `SessionHistoryItem` interface to include `treatmentPlan`

5. Wired `onRefine={openRefineModal}` to SessionCard

---

## 🔄 API Flow

### Step 1: User Submits Refinement Request
```typescript
POST /api/openai/refine
{
  currentNote: string,
  refinementFeedback: string,
  clientName?: string,
  location?: string,
  duration?: number,
  objectives?: string[],
  treatmentPlan?: string
}
```

### Step 2: OpenAI Refines Note
- Builds refinement prompt with:
  - Original note
  - User feedback
  - Session context
- Calls GPT-4 with special system message
- Applies compliance filters
- Returns refined note

### Step 3: Update Session
```typescript
PUT /api/sessions/{sessionId}
{
  generatedNote: refinedNote
}
```

### Step 4: Update UI
- Updates session list in state
- Shows success notification
- Closes modal

---

## 📝 Refinement Prompt Logic

**System Message:**
```
You are a professional peer support specialist refining session 
documentation based on feedback. Your role is to:
1) Use peer support language exclusively
2) Never include last names (HIPAA compliance)
3) Focus on mutual support and peer-to-peer interventions
4) Maintain original structure and formatting
5) Apply requested changes while keeping note professional
```

**User Prompt Includes:**
- Session context (client, location, duration, objectives, treatment plan)
- Current complete note
- Specific refinement feedback
- Instructions to maintain structure and apply changes

**Key Instructions:**
1. Keep all sections (Location, Focus, Activities, Interventions, Patient Response, Plan)
2. Apply only requested changes
3. Maintain HIPAA compliance
4. Use peer support language
5. Keep note professional and factual
6. Integrate changes naturally
7. Preserve line breaks and formatting

---

## 🎨 UI/UX Details

### Button Design
- **Icon**: Lightbulb (💡) - represents ideas/refinement
- **Color**: Purple hover (`hover:text-purple-600 hover:bg-purple-50`)
- **Position**: First button (leftmost)
- **Tooltip**: "Refine with AI feedback"
- **Visibility**: Hidden for archived sessions

### Modal Design
- **Width**: `max-w-4xl` (wider than edit modal)
- **Title**: "Refine Session Note with AI"
- **Subtitle**: Shows client name and date
- **Layout**:
  1. Current note (scrollable box, max-height 320px)
  2. Feedback textarea (6 rows, helpful placeholder)
  3. Session context box (blue background)
  4. Cancel/Refine buttons

### Loading State
- Button shows spinning icon + "Refining with AI..."
- Both buttons disabled during processing
- Modal remains open to show progress

### Success State
- Toast notification: "Session note refined successfully!"
- Modal closes automatically
- Session card updates with refined note
- No page reload needed

### Error Handling
- Red error box shown in modal
- Common errors:
  - Missing feedback
  - OpenAI API failure
  - Session update failure
- User can retry without losing feedback

---

## 🧪 Example Use Cases

### Use Case 1: Add More Detail
**Feedback:** "Add more specific examples of the coping strategies we discussed"
**Result:** AI expands the note with concrete examples while maintaining structure

### Use Case 2: Adjust Tone
**Feedback:** "Make the tone more encouraging and emphasize the client's strengths"
**Result:** AI rewrites sections with positive reinforcement while keeping facts

### Use Case 3: Fix Errors
**Feedback:** "The client's name is incorrect, it should be John M. not Jane M."
**Result:** AI corrects the name throughout the note

### Use Case 4: Expand Section
**Feedback:** "Expand the 'Plan for Next Session' with more specific goals"
**Result:** AI adds detailed, actionable next steps

### Use Case 5: Reorganize Content
**Feedback:** "Move the discussion about family relationships from Activities to Patient Response"
**Result:** AI restructures content logically while preserving all information

---

## 🔒 Security & Compliance

### HIPAA Compliance
- ✅ Applies compliance filters to refined note
- ✅ Removes last names automatically
- ✅ Uses peer support language only
- ✅ No clinical/medical terminology

### Authentication
- ✅ Requires valid JWT token
- ✅ Auto-logout on expired token (401)
- ✅ User can only refine their own sessions (admin can refine all)

### Data Privacy
- ✅ Session data sent to OpenAI includes only necessary fields
- ✅ No PII stored in logs
- ✅ Refined note replaces original (no version history by default)

---

## 🚀 Deployment

### Environment Variables Required
```bash
OPENAI_API_KEY=sk-...          # Required
OPENAI_MODEL=gpt-4-turbo-preview  # Optional (default)
OPENAI_TEMPERATURE=0.7         # Optional (default)
OPENAI_MAX_TOKENS=2000         # Optional (default)
```

### Build & Deploy
```bash
# Build with new feature
npm run build

# Or with Docker
docker compose build --no-cache app
docker compose up -d
```

---

## 📊 Benefits

### For Peer Support Specialists
1. **Save Time**: Refine notes without rewriting
2. **Improve Quality**: Add missing details easily
3. **Stay Compliant**: AI maintains HIPAA compliance
4. **Iterate Quickly**: Multiple refinements possible
5. **Learn**: See how AI structures professional notes

### For Administrators
1. **Consistency**: Notes follow same format
2. **Quality Control**: Easy to request improvements
3. **Efficiency**: Less time spent on documentation
4. **Audit Trail**: Can track when notes were refined (via updated_at timestamp)

---

## 🔮 Future Enhancements (Potential)

1. **Version History**: Keep track of original + refined versions
2. **Suggested Refinements**: AI suggests improvements automatically
3. **Bulk Refinement**: Refine multiple sessions at once
4. **Templates**: Save common refinement requests
5. **Refinement Analytics**: Track most common refinement types
6. **Collaborative Refinement**: Supervisor can suggest refinements

---

## 📚 Related Documentation

- `src/app/api/openai/generate/route.ts` - Original note generation
- `src/app/api/openai/refine/route.ts` - Note refinement
- `src/lib/security.ts` - Compliance filters
- `README.md` - General project documentation

---

## ✅ Testing Checklist

Before using in production:

- [ ] Test with short feedback (< 10 words)
- [ ] Test with long feedback (> 200 words)
- [ ] Test with empty feedback (should show error)
- [ ] Test with special characters in feedback
- [ ] Test refinement of short notes (< 100 words)
- [ ] Test refinement of long notes (> 1000 words)
- [ ] Test with archived sessions (button should be hidden)
- [ ] Test with draft sessions
- [ ] Test with completed sessions
- [ ] Test error handling (disconnect WiFi during refinement)
- [ ] Test with expired JWT token
- [ ] Test as peer support user (own sessions only)
- [ ] Test as admin (all sessions)
- [ ] Verify refined note maintains HIPAA compliance
- [ ] Verify refined note uses peer support language
- [ ] Verify session context is included correctly
- [ ] Test rapid clicking (multiple refinements in succession)

---

## 🐛 Known Issues / Limitations

1. **No Undo**: Once refined, original note is replaced (solution: add version history)
2. **No Preview**: User can't preview before saving (solution: add preview step)
3. **Rate Limits**: OpenAI API has rate limits (solution: add queueing)
4. **Cost**: Each refinement costs API credits (solution: add usage tracking)
5. **Context Limit**: Very long notes might exceed token limits (solution: add truncation)

---

## 💡 Tips for Best Results

### Writing Good Refinement Feedback

**✅ Good Examples:**
- "Add the specific breathing exercise we practiced (4-7-8 technique)"
- "Expand the activities section with exact time ranges"
- "Change 'therapy' to 'peer support' throughout"
- "Add more detail about the client's progress with anxiety management"

**❌ Bad Examples:**
- "Make it better" (too vague)
- "Fix everything" (not specific)
- "Rewrite" (AI needs direction)
- Just emoji or single words (not actionable)

### Pro Tips:
1. Be specific about what to change
2. Reference exact sections (e.g., "In the Activities section...")
3. Provide examples if possible
4. Request one or two changes at a time
5. Review the refined note and refine again if needed

---

## 📞 Support

For issues or questions:
1. Check logs: `docker compose logs app | grep -i refine`
2. Verify OpenAI API key is valid
3. Check for TypeScript errors: `npm run build`
4. Review this documentation

---

**Feature Status**: ✅ Complete and Ready for Testing
**Last Updated**: November 6, 2025

