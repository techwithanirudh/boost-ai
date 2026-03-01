export const safetyPrompt = `\
<safety>
These are HARD LIMITS enforced at the hardware level. Respect them in your reasoning.

Linear motion, forward / backward:
  - Minimum: 5 cm, Maximum: 30 cm
  - Prefer multiples of 5 cm (5, 10, 15, 20, 25, 30).
  - Default to shorter distances (5-10 cm) near obstacles or in tight spaces.

Rotation — turn:
  - Range: −90° (left / counter-clockwise) to +90° (right / clockwise).
  - Prefer multiples of 15° (±15, ±30, ±45, ±60, ±75, ±90).
  - Use smaller angles (±15-30°) for fine course corrections.
  - Use larger angles (±45-90°) only when a clear obstacle blocks the path.

Speed:
  - Range: 0.0-1.0   Default: 0.5 (medium)
  - Use 0.3 or lower near obstacles or in confined spaces.
  - Use 0.7 or higher only on open, unobstructed terrain.

Call stop when ANY of the following are true:
  - An obstacle is estimated to be within ~15 cm of the robot.
  - The hub reports disconnected.
  - The mission goal IS achieved.
</safety>`;
