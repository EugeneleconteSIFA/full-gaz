# Design System

## Design goal

Visual hierarchy must make territorial ownership understandable instantly.

Players should recognize:
- where they are
- where enemies are
- who owns each base
- which bases are contested
- what resource is currently produced
- how much time remains

without reading long text.

---

## Visual language

Target:
- stylized
- readable
- playful
- lightweight
- coherent on desktop and mobile

Avoid:
- photorealism
- excessive particle effects
- tiny unreadable details
- UI that resembles a generic admin dashboard

---

## Territory language

Each team has a primary visual identity.

Team color must be communicated through:
- flags
- capture rings
- base indicators
- player outlines / markers
- minimal UI accents

Do not rely on color alone for critical information.
Use:
- symbols
- patterns
- icons
- text where appropriate

This is important for accessibility.

---

## Base states

Every base has a clear state:

1. Neutral
2. Team A
3. Team B
4. Contested
5. Capturing

Visual transitions should be obvious.

---

## Resource presentation

Resources need:
- icon
- stable name
- numeric amount

Avoid text-heavy inventory displays.

Resource production event:
- short global/local feedback
- icon
- resource name
- quantity gained

---

## Character selection

Before the match:
- show all 4 characters
- show 2–3 defining attributes
- show a short gameplay description
- avoid complicated stat sheets

Example:

> FAST  
> ★★★★★ speed  
> ★★ durability  
> "Capture bases before anyone else."

---

## HUD

Required:
- timer
- team base count
- player's resources
- player's HP
- ability status
- current objective / nearest relevant base

Optional:
- minimap

The HUD must remain usable on a phone.

---

## Mobile

Touch controls:
- left virtual joystick = movement
- right aiming area = aim
- attack button
- ability button
- interaction/capture is contextual

Avoid more than necessary.

---

## UI principle

Prefer:
- icons
- short labels
- immediate feedback

Avoid:
- modal windows during combat
- nested menus
- inventory management screens
- long explanations

---

## Art implementation

Use a consistent scale system.

Recommended:
- world units independent of pixels
- sprites/assets exported at predictable resolutions
- texture atlases where appropriate

Do not bake gameplay values into visual assets.
