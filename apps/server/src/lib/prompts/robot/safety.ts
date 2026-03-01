export const safetyPrompt = `\
<safety>
These are command limits enforced by the actuator API.
In simulator mode, optimize for speed and completion within these limits.

Linear motion, forward / backward:
  - Minimum: 5 cm, Maximum: 30 cm
  - Prefer multiples of 5 cm (5, 10, 15, 20, 25, 30).
  - Prefer longer distances (20-30 cm) for faster progress.

Rotation — turn:
  - Range: -90° (left / counter-clockwise) to +90° (right / clockwise).
  - Prefer multiples of 15° (±15, ±30, ±45, ±60, ±75, ±90).
  - For scan/correction loops, prefer repeated +15° turns.

Speed:
  - Range: 0.0-1.0
  - Prefer high speed (0.8-1.0) for rapid completion.

Call stop only when execution cannot continue (e.g., hub disconnected or unrecoverable error).
</safety>`;
