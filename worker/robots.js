// robots.txt nach RFC 9309 (Gruppen je User-Agent, längste Übereinstimmung gewinnt, bei Gleichstand Allow).
// Unterstützt `*` und `$`. Nicht umgesetzt: Prozent-Normalisierung beim Pfadvergleich.

// Ehrlicher User-Agent für den Link-Import (Seite und robots.txt); der Produktname ist der robots.txt-Gruppenname.
export const PAGE_AGENT_NAME = 'NutriTrackRecipeImport';

/** Zerlegt robots.txt in Gruppen { agents, rules }; Regeln vor der ersten User-agent-Zeile werden ignoriert. */
function parseRobotsGroups(text) {
  const groups = [];
  let isCollectingAgents = false;
  for (const rawLine of text.split(/\r\n|\r|\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      if (!isCollectingAgents) groups.push({ agents: [], rules: [] });
      groups[groups.length - 1].agents.push(value.toLowerCase());
      isCollectingAgents = true;
    } else if (field === 'allow' || field === 'disallow') {
      isCollectingAgents = false;
      const group = groups[groups.length - 1];
      if (group && value !== '') group.rules.push({ isAllow: field === 'allow', pattern: value });
    }
  }
  return groups;
}

/** Eigene Gruppe(n) haben Vorrang vor `*`. */
function rulesForAgent(groups) {
  const own = groups.filter((g) => g.agents.includes(PAGE_AGENT_NAME.toLowerCase()));
  const chosen = own.length > 0 ? own : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

/** Präfix-Vergleich mit `*` (beliebig viele Zeichen) und `$` (Ende); iterativ, damit viele `*` nicht explodieren. */
function matchesRobotsPattern(pattern, path) {
  const isAnchored = pattern.endsWith('$');
  const glob = isAnchored ? pattern.slice(0, -1) : pattern;
  let g = 0;
  let i = 0;
  let starG = -1;
  let starI = 0;
  for (;;) {
    if (g === glob.length && (!isAnchored || i === path.length)) return true;
    if (g < glob.length && glob[g] === '*') {
      starG = g++;
      starI = i;
      continue;
    }
    if (g < glob.length && i < path.length && glob[g] === path[i]) {
      g++;
      i++;
      continue;
    }
    if (starG < 0 || starI >= path.length) return false;
    g = starG + 1;
    i = ++starI;
  }
}

function isPathAllowedByRules(rules, path) {
  const matching = rules.filter((r) => matchesRobotsPattern(r.pattern, path));
  if (matching.length === 0) return true;
  const best = matching.reduce((a, b) => {
    if (b.pattern.length !== a.pattern.length) return b.pattern.length > a.pattern.length ? b : a;
    return b.isAllow ? b : a;
  });
  return best.isAllow;
}

/** Auswertung einer robots.txt für unseren User-Agent und einen Pfad (inkl. Query). */
export function robotsAllows(robotsText, path) {
  return isPathAllowedByRules(rulesForAgent(parseRobotsGroups(robotsText)), path);
}
