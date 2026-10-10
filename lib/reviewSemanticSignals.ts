/** Deterministic, conservative phrase normalization. Original evidence is never replaced. */
export const SEMANTIC_VERSION = "review-semantics-v3";
export function semanticText(text: string): string {
  return text.normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase()
    .normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/\b(?:tres confortable|muy comod[oa]|sehr bequem)\b/g, "very comfortable")
    .replace(/\b(?:bonne? achat pour le prix|buena relacion calidad precio|gutes preis leistungs verhaltnis)\b/g, "good value for the price")
    .replace(/\b(?:se recharge rapidement|carga rapidamente)\b/g, "charges quickly")
    .replace(/\b(?:autonomie|batterie|bateria)\b/g, "battery")
    .replace(/\b(?:plus de (\d+) jours)\b/g, "lasts $1 days")
    .replace(/\b(?:facile a nettoyer|facil de limpiar)\b/g, "easy to clean")
    .replace(/\b(?:facile a utiliser|facil de usar)\b/g, "easy to use")
    .replace(/\b(?:ne fonctionne pas|no funciona|funktioniert nicht)\b/g, "does not work")
    .replace(/\b(?:en panne|se rompio|kaputt)\b/g, "broken")
    .replace(/\b(?:surchauffe|sobrecalienta)\b/g, "overheats")
    .replace(/\b(?:j'adore|je recommande|recomiendo)\b/g, "recommend")
    .replace(/\b(?:je ne recommande pas|no recomiendo)\b/g, "do not recommend")
    // Explicit evaluative phrases only (v2); unrecognised text stays unanalysed.
    // Category nouns are not evaluations ("slow cooker", "hard drive", "hard case").
    .replace(/\bslow[- ]cook(?:er|ers|ing|s)?\b/g, "slowcooker")
    .replace(/\bhard (?:drive|drives|case|shell|boiled|floors?|flooring|surfaces?|wood|water|plastic|tile|candy)\b/g, "hardgoods")
    // A rhetorical question about a reported issue is not this reviewer's observation.
    .replace(/\bhardwood\b/g, "hardgoods")
    .replace(/\bhard to beat\b/g, "great")
    .replace(/\b(?:very|really|so|pretty) hard (?=&|and|before|to research|researching|shopped|looking)/g, "diligently ")
    .replace(/\b(?:shopped|looked|searched|researched|worked|tried) (?:very |really |so )?hard\b/g, "searched diligently")
    .replace(/\b(?:couldn't|could not|could not possibly) be (?:happier|more (?:pleased|satisfied|happy))\b/g, "very happy")
    .replace(/\b(?:favou?rite)\b/g, "love")
    .replace(/\b(?:haven't|have not|never|didn't|did not|no) (?:(?:had|encountered|experienced|run into|seen) )?(?:any )?(?:major |real |significant )?(?:issues?|problems?)\b/g, "no problems")
    .replace(/\b(?:excelente|inmejorable|excellente)\b/g, "excellent")
    .replace(/\b(?:muy buen[oa]|tres bien|tres bon(?:ne)?)\b/g, "very good")
    .replace(/\b(?:(?:de )?(?:gran|buena) calidad|bonne qualite)\b/g, "good quality")
    .replace(/\b(?:mala calidad|mauvaise qualite)\b/g, "poor quality")
    .replace(/\b(?:estoy conforme|satisfecho|satisfecha|satisfait|satisfaite)\b/g, "satisfied")
    .replace(/\b(?:decepcionad[oa]|decepcionante|decu|decue|decevant)\b/g, "disappointed")
    // v3: product-agnostic evaluative phrasing (EN/FR/ES). Each maps to an
    // existing scored word; negation/expectation handling stays in the scorer.
    // Generic praise.
    .replace(/\b(?:amazing|incredible|outstanding|superb|wonderful|terrific|brilliant|phenomenal|exceptional|impressive|stellar|top[- ]notch|first[- ]rate|flawless)\b/g, "great")
    .replace(/\b(?:pleased|delighted|thrilled|glad i (?:bought|got|purchased) (?:it|this|these|them))\b/g, "happy")
    .replace(/\b(?:highly recommend(?:ed)?|would recommend|definitely recommend|recommend (?:it|this|them|these))\b/g, "recommend")
    .replace(/\b(?:exceeded (?:my |all )?expectations|as (?:described|advertised|expected)|does (?:the|its) job|does what it (?:says|should|claims)|no complaints)\b/g, "works")
    .replace(/\b(?:a breeze|straightforward|intuitive|user[- ]friendly|simple to (?:use|set up|setup|install|assemble))\b/g, "easy")
    // Build / durability / comfort / performance aspects.
    .replace(/\b(?:well (?:made|built|designed|constructed)|sturdy|robust|built to last|high quality|premium (?:feel|build|quality))\b/g, "solid")
    .replace(/\b(?:(?:still )?going strong|holds up (?:well|great)|held up (?:well|great))\b/g, "durable")
    .replace(/\b(?:fits? (?:perfectly|well|great|comfortably)|lightweight and comfortable|easy on the ears)\b/g, "comfortable")
    .replace(/\b(?:(?:sound|audio|bass|picture|image|suction|performance) (?:is|was|are) (?:great|excellent|amazing|fantastic|incredible|crisp|clear|rich|superb|impressive)|(?:crisp|clear|rich|full|deep|punchy) (?:sound|audio|bass))\b/g, "great")
    .replace(/\b(?:battery (?:life )?(?:is|was) (?:great|excellent|amazing|fantastic|long|impressive)|(?:great|long|excellent|amazing) battery(?: life)?|holds? (?:a|its) charge)\b/g, "lasts")
    .replace(/\b(?:very |super |extremely )?(?:powerful|efficient)\b/g, "fast")
    // Generic complaints.
    .replace(/\b(?:terrible|awful|horrible|horrendous|junk|garbage|crap|mediocre|underwhelming|subpar|sub-par|lousy|cheap(?:ly)? made|flimsy|feels cheap)\b/g, "bad")
    .replace(/\b(?:fell apart|falling apart|came apart|snapped|leaks?|leaking|leaked|rattl(?:es|ing)|malfunction(?:s|ed|ing)?|glitch(?:es|y)?|buggy|laggy|keeps (?:disconnecting|dropping|cutting out)|(?:disconnects|cuts out) (?:randomly|constantly|frequently))\b/g, "problem")
    .replace(/\b(?:battery (?:life )?(?:is|was) (?:terrible|awful|bad|poor|short|disappointing)|(?:poor|bad|short|terrible) battery(?: life)?|(?:won't|doesn't|does not|will not) hold (?:a|its) charge|battery drains)\b/g, "weak")
    .replace(/\b(?:uncomfortable|hurts? (?:my|the) (?:ears|head|hands?|back)|too (?:tight|bulky))\b/g, "difficult")
    .replace(/\b(?:not as (?:described|advertised|pictured)|waste of time|regret (?:buying|purchasing|this|it)|never (?:again|buying again)|stay away|avoid (?:this|it))\b/g, "disappointed")
    .replace(/\b(?:customer (?:service|support)|support team|the seller) (?:was|is|were) (?:unhelpful|useless|terrible|awful|rude|non-?existent)\b/g, "bad")
    .replace(/\b(?:had to (?:return|send) (?:it|this|them) back|sent (?:it|them) back|returning (?:it|this|them))\b/g, "returned")
    // FR / ES.
    .replace(/\b(?:genial|parfait|parfaite|perfecto|perfecta|magnifique|increible|maravillos[oa]|me encanta|le encanta|lo amo)\b/g, "love")
    .replace(/\b(?:fonctionne (?:tres )?bien|marche (?:tres )?bien|funciona (?:muy )?bien|funciona perfecto)\b/g, "works")
    .replace(/\b(?:facile|facil|sencillo|sencilla)\b/g, "easy")
    .replace(/\b(?:lo recomiendo|la recomiendo|los recomiendo|recommande|recomendable|recomendado)\b/g, "recommend")
    .replace(/\b(?:nul|nulle|horrible|terrible|malo|mala|pesimo|pesima|de mala calidad)\b/g, "bad")
    .replace(/\b(?:arrete de fonctionner|dejo de funcionar|ne marche (?:pas|plus)|no sirve|parou de funcionar)\b/g, "stopped")
    // PT basics.
    .replace(/\b(?:maravilhos[oa]|otim[oa]|adorei|amei)\b/g, "love")
    .replace(/\b(?:recomendo)\b/g, "recommend")
    .replace(/\b(?:pessim[oa]|horrivel|nao funciona)\b/g, "bad")
    .replace(/\bheavy[- ]duty\b/g, "solid")
    // Safety observations (scored as safety complaints by the scorer).
    .replace(/\b(?:(?:issued|threw|gave off|emitted|produced) sparks|sparked|sparking|(?:smell of|smelled like|smells like) burning|burning smell|started smoking|smoke came out)\b(?!\s*\?)/g, "unsafe");
}

/** A hint, not a calibrated detector; ambiguous/unrecognized text stays unknown. */
export function reviewLanguageHint(text: string): "en" | "fr" | "es" | "de" | "unknown" {
  const normalized = text.normalize("NFKC").replace(/[’‘]/g, "'").toLowerCase();
  const hints = [
    [/\b(?:je|nous|bague|confortable|autonomie|batterie)\b|j'(?:ai|adore)/u, "fr"],
    [/\b(?:compré|comprado|batería|producto|funciona|cómodo|limpiar)\b/u, "es"],
    [/\b(?:gekauft|benutzt|bequem|funktioniert|kaputt|gerät)\b/u, "de"],
    [/\b(?:my|bought|purchased|battery|comfortable|works|worked|using)\b/u, "en"],
  ] as const;
  const matched = hints.filter(([pattern]) => pattern.test(normalized));
  return matched.length === 1 ? matched[0][1] : "unknown";
}
