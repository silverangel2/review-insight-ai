#!/usr/bin/env python3
"""One-shot builder: adds the `Brief` dictionary section to messages/*.json.

en is the source of truth (every key present). fr/es are fully translated by
the builder (human-authored, careful). de carries confident short labels only;
hi/zh carry verdict words only. Every other key falls back to en per-string at
runtime (lib/briefI18n.ts) — never a raw key, never a blank.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, "messages")

EN_BRIEF = {
  "shouldYouBuy": "Should you buy it?",
  "buyingScore": "Buying Score",
  "verdict": {
    "buy": "Buy", "wait": "Wait", "skip": "Skip",
    "lowConfidence": "Low confidence", "tryAgain": "Try again",
    "leaningBuy": "Leaning Buy", "leaningSkip": "Leaning Skip",
  },
  "factTerms": {
    "marketplaceRating": "Marketplace rating",
    "ratingsCounted": "Ratings counted",
    "howSureWeAre": "How sure we are",
    "valueForMoney": "Value for money",
    "reviewAuthenticity": "Review authenticity",
  },
  "confidence": {"high": "High", "medium": "Medium", "low": "Low", "unknown": "Unknown"},
  "value": {"good": "Good", "fair": "Fair", "poor": "Poor"},
  "depth": {"few": "a few", "solid": "a solid set of", "deep": "a deep set of"},
  "basisFrames": [
    "Based on {basis}.",
    "This is based on {basis}.",
    "We based this verdict on {basis}.",
    "Here's what backs this: {basis}.",
  ],
  "basisParts": {
    "marketplaceRating": "the marketplace rating",
    "writtenReviews": "{depth} written reviews we read",
  },
  "limitsFrames": [
    "The written reviews come from {store}'s pages \u2014 reviews on other stores aren't part of this check.",
    "One thing to know: the written reviews are from {store}'s pages only, so other stores' reviews aren't in this check.",
    "A caveat: only {store}'s written reviews fed this check \u2014 other stores' reviews didn't.",
    "Keep in mind the written reviews are from {store}'s pages \u2014 this doesn't cover other stores.",
  ],
  "authRows": {
    "low": "Few AI-like signs",
    "moderate": "Some AI-like signs",
    "high": "Strong AI-like pattern",
  },
  "authLow": [
    "The reviews read like real buyers: varied wording, concrete details, and a natural spread of opinions.",
    "Nothing here trips our pattern checks \u2014 the reviews sound like different people with different experiences.",
    "The corpus looks human: diverse phrasing, specific observations, no template feel.",
    "These reviews pass the smell test \u2014 varied, specific, and independently worded.",
    "Real-buyer markers throughout: different words, concrete details, mixed enthusiasm.",
    "No AI-like pattern here. The reviews vary the way independent buyers do.",
  ],
  "authModerateBase": [
    "Some reviews {signals} \u2014 an AI-like pattern we watch for.",
    "We see mild AI-like signs: some reviews {signals}.",
    "A few pattern flags here \u2014 some reviews {signals}.",
    "Not conclusive, but some reviews {signals}, which is an AI-like pattern.",
    "Mixed authenticity: some reviews {signals}.",
    "Worth a grain of salt \u2014 some reviews {signals}.",
  ],
  "authHighBase": [
    "The reviews {signals} \u2014 a strong AI-like pattern across the corpus.",
    "Strong AI-like pattern: the reviews {signals}.",
    "These reviews {signals}, which is the classic AI-like shape.",
    "The pattern is hard to miss \u2014 the reviews {signals}.",
    "High AI-like pattern: reviews {signals}.",
    "Across the corpus, the reviews {signals} \u2014 strongly AI-like.",
  ],
  "signalClauses": {
    "repetition": "repeat the same phrasing",
    "template": "follow the same template",
    "specificity": "praise without concrete details",
    "uniformity": "sound uniformly enthusiastic",
    "lexical": "reuse a small set of words",
  },
  "honestyFrames": [
    "This checks review text for patterns only \u2014 it can't prove who wrote a review.",
    "It's a text-pattern check, not a verdict on the reviewer \u2014 it can't prove who wrote what.",
    "Think of it as a pattern scan of the wording: it can't tell you who actually wrote a review.",
  ],
  "scoreFeedsLine": "Only real written reviews and the marketplace rating feed the score.",
  "independenceLine": "We read the buyer reviews, grouped what buyers kept saying, and weighed the good against the bad. We're independent \u2014 not affiliated with or endorsed by any brand.",
  "whyBuyIt": "Why you'd buy it",
  "whyMightNot": "Why you might not",
  "howWeChecked": "How we checked",
  "footerLine": "Analysis of real written buyer reviews and the marketplace rating.",
  "complaintNotes": {
    "oneOff": "No complaint repeats across buyers \u2014 these are one-off concerns, shown because they matter.",
    "repeated": "These concerns came up across multiple buyers.",
    "isolated": "Buyers raised isolated concerns{about} \u2014 each is weighed against the praise above, where it's noted.",
    "none": "No buyer complaints in the reviews we read.",
  },
  "answer": {
    "neutralBuy": "Buyers are mostly positive about this product.",
    "neutralSkip": "Buyers report enough problems to skip this.",
    "neutralWait": "Buyer feedback is mixed or still limited.",
    "whyBuyBase": "Buyers consistently report {love}",
    "whyBuyDefaultLove": "good results",
    "whyBuyComplaintTail": ", and complaints like {complaint} are rare.",
    "whySkipBase": "Too many buyers report {complaint}",
    "whySkipDefaultComplaint": "serious problems",
    "whySkipLoveTail": ", which outweighs {love}.",
    "whyWaitBase": "Buyers like {love}",
    "whyWaitDefaultLove": "parts of it",
    "whyWaitComplaintTail": ", but buyers also mention {complaint}",
    "whyWaitCloser": "The reviews aren't strong enough yet for a clear {buy}.",
    "whyNotEnoughListing": "Low confidence. Add a review screenshot to read more real reviews.",
    "whyNotEnoughNoListing": "Low confidence. Scan the Amazon listing link or add a review screenshot to read more real reviews.",
    "trustBasedOn": "Based on real buyer reviews from {sources}.",
    "trustLow": "Low confidence.",
    "trustUnreadable": "{retry} Add a screenshot of the product page and try the scan again.",
    "retryFree": "Retrying is free.",
    "retryLater": "Please try again in a moment.",
    "unreadableAmazon": "We couldn't read this Amazon page right now.",
    "unreadableListing": "We couldn't read this product page right now.",
    "neutralProduct": "Amazon product",
    "evidenceStrength": {"strong": "Strong", "moderate": "Moderate", "low": "Low"},
    "steps": {
      "retry": {"label": "Try again", "detail": "{unreadable} {retry}"},
      "screenshots": {"label": "Add a screenshot",
                      "detail": "Add a screenshot of the product page so we can read the title, stars, and reviews."},
      "amazonListing": {"label": "Scan the Amazon listing",
                        "detail": "Scan the Amazon listing link so we can read more real reviews of this exact product."},
      "reviewScreenshot": {"label": "Add a review screenshot",
                           "detail": "Upload a screenshot of reviews you can see. We read the text and only keep real reviews of this exact product."},
      "compare": {"label": "Compare with an alternative",
                  "detail": "Scan a similar product and compare what real buyers say."},
    },
  },
}

FR_BRIEF = {
  "shouldYouBuy": "Faut-il l'acheter ?",
  "buyingScore": "Score d'achat",
  "verdict": {
    "buy": "Acheter", "wait": "Attendre", "skip": "Passer",
    "lowConfidence": "Confiance faible", "tryAgain": "R\u00e9essayer",
    "leaningBuy": "Plut\u00f4t acheter", "leaningSkip": "Plut\u00f4t passer",
  },
  "factTerms": {
    "marketplaceRating": "Note du march\u00e9",
    "ratingsCounted": "Avis compt\u00e9s",
    "howSureWeAre": "Notre niveau de certitude",
    "valueForMoney": "Rapport qualit\u00e9-prix",
    "reviewAuthenticity": "Authenticit\u00e9 des avis",
  },
  "confidence": {"high": "\u00c9lev\u00e9e", "medium": "Moyenne", "low": "Faible", "unknown": "Inconnue"},
  "value": {"good": "Bon", "fair": "Correct", "poor": "Mauvais"},
  "depth": {"few": "quelques", "solid": "un bon nombre d'", "deep": "un grand nombre d'"},
  "basisFrames": [
    "D'apr\u00e8s {basis}.",
    "Ceci est bas\u00e9 sur {basis}.",
    "Nous avons bas\u00e9 ce verdict sur {basis}.",
    "Voici ce qui l'\u00e9taye : {basis}.",
  ],
  "basisParts": {
    "marketplaceRating": "la note du march\u00e9",
    "writtenReviews": "{depth} avis \u00e9crits que nous avons lus",
  },
  "limitsFrames": [
    "Les avis \u00e9crits proviennent des pages de {store} \u2014 les avis d'autres boutiques ne font pas partie de cette v\u00e9rification.",
    "Bon \u00e0 savoir : les avis \u00e9crits viennent uniquement des pages de {store}, donc les avis d'autres boutiques n'y figurent pas.",
    "Petite r\u00e9serve : seuls les avis \u00e9crits de {store} ont aliment\u00e9 cette v\u00e9rification \u2014 pas ceux d'autres boutiques.",
    "Gardez \u00e0 l'esprit que les avis \u00e9crits viennent des pages de {store} \u2014 cela ne couvre pas les autres boutiques.",
  ],
  "authRows": {
    "low": "Peu de signes d'IA",
    "moderate": "Quelques signes d'IA",
    "high": "Fort motif de type IA",
  },
  "authLow": [
    "Les avis ressemblent \u00e0 de vrais acheteurs : formulations vari\u00e9es, d\u00e9tails concrets et un \u00e9ventail naturel d'opinions.",
    "Rien ici ne d\u00e9clenche nos contr\u00f4les de motifs \u2014 les avis sonnent comme des personnes diff\u00e9rentes avec des exp\u00e9riences diff\u00e9rentes.",
    "Le corpus a l'air humain : formulations diverses, observations pr\u00e9cises, aucun effet de mod\u00e8le.",
    "Ces avis passent le test \u2014 vari\u00e9s, pr\u00e9cis et r\u00e9dig\u00e9s de fa\u00e7on ind\u00e9pendante.",
    "Des marqueurs de vrais acheteurs partout : des mots diff\u00e9rents, des d\u00e9tails concrets, un enthousiasme nuanc\u00e9.",
    "Aucun motif de type IA ici. Les avis varient comme le font des acheteurs ind\u00e9pendants.",
  ],
  "authModerateBase": [
    "Certains avis {signals} \u2014 un motif de type IA que nous surveillons.",
    "Nous voyons de l\u00e9gers signes de type IA : certains avis {signals}.",
    "Quelques drapeaux ici \u2014 certains avis {signals}.",
    "Ce n'est pas concluant, mais certains avis {signals}, ce qui est un motif de type IA.",
    "Authenticit\u00e9 mitig\u00e9e : certains avis {signals}.",
    "\u00c0 prendre avec des pincettes \u2014 certains avis {signals}.",
  ],
  "authHighBase": [
    "Les avis {signals} \u2014 un fort motif de type IA dans tout le corpus.",
    "Fort motif de type IA : les avis {signals}.",
    "Ces avis {signals}, ce qui est la forme classique de type IA.",
    "Le motif est difficile \u00e0 manquer \u2014 les avis {signals}.",
    "Motif de type IA \u00e9lev\u00e9 : les avis {signals}.",
    "Dans tout le corpus, les avis {signals} \u2014 fortement de type IA.",
  ],
  "signalClauses": {
    "repetition": "r\u00e9p\u00e8tent les m\u00eames formulations",
    "template": "suivent le m\u00eame mod\u00e8le",
    "specificity": "louent sans d\u00e9tails concrets",
    "uniformity": "sonnent uniform\u00e9ment enthousiastes",
    "lexical": "r\u00e9utilisent un petit nombre de mots",
  },
  "honestyFrames": [
    "Ceci ne v\u00e9rifie le texte des avis que pour y d\u00e9celer des motifs \u2014 cela ne peut pas prouver qui a \u00e9crit un avis.",
    "C'est une v\u00e9rification de motifs textuels, pas un verdict sur l'auteur \u2014 cela ne peut pas prouver qui a \u00e9crit quoi.",
    "Voyez-le comme une analyse des motifs de formulation : cela ne peut pas dire qui a r\u00e9ellement \u00e9crit un avis.",
  ],
  "scoreFeedsLine": "Seuls les vrais avis \u00e9crits et la note du march\u00e9 alimentent le score.",
  "independenceLine": "Nous avons lu les avis des acheteurs, regroup\u00e9 ce qu'ils r\u00e9p\u00e9taient et pes\u00e9 le bon contre le mauvais. Nous sommes ind\u00e9pendants \u2014 ni affili\u00e9s \u00e0 une marque ni approuv\u00e9s par elle.",
  "whyBuyIt": "Pourquoi l'acheter",
  "whyMightNot": "Pourquoi h\u00e9siter",
  "howWeChecked": "Comment nous avons v\u00e9rifi\u00e9",
  "footerLine": "Analyse de vrais avis \u00e9crits d'acheteurs et de la note du march\u00e9.",
  "complaintNotes": {
    "oneOff": "Aucune plainte ne se r\u00e9p\u00e8te d'un acheteur \u00e0 l'autre \u2014 ce sont des pr\u00e9occupations isol\u00e9es, affich\u00e9es parce qu'elles comptent.",
    "repeated": "Ces pr\u00e9occupations sont revenues chez plusieurs acheteurs.",
    "isolated": "Les acheteurs ont soulev\u00e9 des pr\u00e9occupations isol\u00e9es{about} \u2014 chacune est pes\u00e9e face aux \u00e9loges ci-dessus, o\u00f9 c'est indiqu\u00e9.",
    "none": "Aucune plainte d'acheteur dans les avis que nous avons lus.",
  },
  "answer": {
    "neutralBuy": "Les acheteurs sont plut\u00f4t positifs \u00e0 propos de ce produit.",
    "neutralSkip": "Les acheteurs signalent assez de probl\u00e8mes pour le passer.",
    "neutralWait": "Les retours des acheteurs sont mitig\u00e9s ou encore limit\u00e9s.",
    "whyBuyBase": "Les acheteurs signalent r\u00e9guli\u00e8rement {love}",
    "whyBuyDefaultLove": "de bons r\u00e9sultats",
    "whyBuyComplaintTail": ", et les plaintes comme {complaint} sont rares.",
    "whySkipBase": "Trop d'acheteurs signalent {complaint}",
    "whySkipDefaultComplaint": "de s\u00e9rieux probl\u00e8mes",
    "whySkipLoveTail": ", ce qui l'emporte sur {love}.",
    "whyWaitBase": "Les acheteurs aiment {love}",
    "whyWaitDefaultLove": "certains aspects",
    "whyWaitComplaintTail": ", mais les acheteurs mentionnent aussi {complaint}",
    "whyWaitCloser": "Les avis ne sont pas encore assez solides pour un {buy} clair.",
    "whyNotEnoughListing": "Confiance faible. Ajoutez une capture d'avis pour lire plus de vrais avis.",
    "whyNotEnoughNoListing": "Confiance faible. Scannez le lien de l'annonce Amazon ou ajoutez une capture d'avis pour lire plus de vrais avis.",
    "trustBasedOn": "D'apr\u00e8s de vrais avis d'acheteurs de {sources}.",
    "trustLow": "Confiance faible.",
    "trustUnreadable": "{retry} Ajoutez une capture de la page produit et relancez l'analyse.",
    "retryFree": "Relancer est gratuit.",
    "retryLater": "Veuillez r\u00e9essayer dans un instant.",
    "unreadableAmazon": "Nous n'avons pas pu lire cette page Amazon pour le moment.",
    "unreadableListing": "Nous n'avons pas pu lire cette page produit pour le moment.",
    "neutralProduct": "Produit Amazon",
    "evidenceStrength": {"strong": "Fort", "moderate": "Mod\u00e9r\u00e9", "low": "Faible"},
    "steps": {
      "retry": {"label": "R\u00e9essayer", "detail": "{unreadable} {retry}"},
      "screenshots": {"label": "Ajouter une capture",
                      "detail": "Ajoutez une capture de la page produit pour que nous puissions lire le titre, les \u00e9toiles et les avis."},
      "amazonListing": {"label": "Scanner l'annonce Amazon",
                       "detail": "Scannez le lien de l'annonce Amazon pour lire plus de vrais avis sur ce produit exact."},
      "reviewScreenshot": {"label": "Ajouter une capture d'avis",
                           "detail": "T\u00e9l\u00e9versez une capture des avis que vous voyez. Nous lisons le texte et ne gardons que les vrais avis sur ce produit exact."},
      "compare": {"label": "Comparer avec une alternative",
                  "detail": "Scannez un produit similaire et comparez ce que disent les vrais acheteurs."},
    },
  },
}

ES_BRIEF = {
  "shouldYouBuy": "\u00bfDeber\u00edas comprarlo?",
  "buyingScore": "Puntuaci\u00f3n de compra",
  "verdict": {
    "buy": "Comprar", "wait": "Esperar", "skip": "Omitir",
    "lowConfidence": "Poca confianza", "tryAgain": "Int\u00e9ntalo de nuevo",
    "leaningBuy": "Tiende a comprar", "leaningSkip": "Tiende a omitir",
  },
  "factTerms": {
    "marketplaceRating": "Valoraci\u00f3n del mercado",
    "ratingsCounted": "Valoraciones contadas",
    "howSureWeAre": "Qu\u00e9 tan seguros estamos",
    "valueForMoney": "Relaci\u00f3n calidad-precio",
    "reviewAuthenticity": "Autenticidad de las rese\u00f1as",
  },
  "confidence": {"high": "Alta", "medium": "Media", "low": "Baja", "unknown": "Desconocida"},
  "value": {"good": "Buena", "fair": "Aceptable", "poor": "Mala"},
  "depth": {"few": "unas pocas", "solid": "un buen conjunto de", "deep": "un amplio conjunto de"},
  "basisFrames": [
    "Basado en {basis}.",
    "Esto se basa en {basis}.",
    "Basamos este veredicto en {basis}.",
    "Esto es lo que lo respalda: {basis}.",
  ],
  "basisParts": {
    "marketplaceRating": "la valoraci\u00f3n del mercado",
    "writtenReviews": "{depth} rese\u00f1as escritas que le\u00edmos",
  },
  "limitsFrames": [
    "Las rese\u00f1as escritas provienen de las p\u00e1ginas de {store}: las rese\u00f1as de otras tiendas no forman parte de este an\u00e1lisis.",
    "Algo que debes saber: las rese\u00f1as escritas son solo de las p\u00e1ginas de {store}, as\u00ed que las rese\u00f1as de otras tiendas no est\u00e1n incluidas.",
    "Una advertencia: solo las rese\u00f1as escritas de {store} alimentaron este an\u00e1lisis; las de otras tiendas no.",
    "Ten en cuenta que las rese\u00f1as escritas son de las p\u00e1ginas de {store}: esto no cubre otras tiendas.",
  ],
  "authRows": {
    "low": "Pocas se\u00f1ales de IA",
    "moderate": "Algunas se\u00f1ales de IA",
    "high": "Patr\u00f3n fuerte de IA",
  },
  "authLow": [
    "Las rese\u00f1as parecen de compradores reales: redacci\u00f3n variada, detalles concretos y una diversidad natural de opiniones.",
    "Nada aqu\u00ed activa nuestros controles de patrones: las rese\u00f1as suenan como personas distintas con experiencias distintas.",
    "El corpus parece humano: redacci\u00f3n diversa, observaciones espec\u00edficas, sin sensaci\u00f3n de plantilla.",
    "Estas rese\u00f1as pasan la prueba: variadas, espec\u00edficas y redactadas de forma independiente.",
    "Marcas de comprador real en todo el texto: palabras distintas, detalles concretos, entusiasmo matizado.",
    "Ning\u00fan patr\u00f3n de IA aqu\u00ed. Las rese\u00f1as var\u00edan como lo hacen los compradores independientes.",
  ],
  "authModerateBase": [
    "Algunas rese\u00f1as {signals}: un patr\u00f3n de IA que vigilamos.",
    "Vemos se\u00f1ales leves de IA: algunas rese\u00f1as {signals}.",
    "Algunas alertas aqu\u00ed: algunas rese\u00f1as {signals}.",
    "No es concluyente, pero algunas rese\u00f1as {signals}, lo cual es un patr\u00f3n de IA.",
    "Autenticidad mixta: algunas rese\u00f1as {signals}.",
    "T\u00f3malo con cautela: algunas rese\u00f1as {signals}.",
  ],
  "authHighBase": [
    "Las rese\u00f1as {signals}: un fuerte patr\u00f3n de IA en todo el corpus.",
    "Fuerte patr\u00f3n de IA: las rese\u00f1as {signals}.",
    "Estas rese\u00f1as {signals}, que es la forma cl\u00e1sica de la IA.",
    "El patr\u00f3n es dif\u00edcil de pasar por alto: las rese\u00f1as {signals}.",
    "Patr\u00f3n de IA alto: las rese\u00f1as {signals}.",
    "En todo el corpus, las rese\u00f1as {signals}: claramente de IA.",
  ],
  "signalClauses": {
    "repetition": "repiten las mismas frases",
    "template": "siguen la misma plantilla",
    "specificity": "elogian sin detalles concretos",
    "uniformity": "suenan uniformemente entusiastas",
    "lexical": "reutilizan un conjunto peque\u00f1o de palabras",
  },
  "honestyFrames": [
    "Esto solo analiza el texto de las rese\u00f1as en busca de patrones: no puede probar qui\u00e9n escribi\u00f3 una rese\u00f1a.",
    "Es una comprobaci\u00f3n de patrones de texto, no un veredicto sobre el autor: no puede probar qui\u00e9n escribi\u00f3 qu\u00e9.",
    "Piensa en ello como un escaneo de patrones de redacci\u00f3n: no puede decirte qui\u00e9n escribi\u00f3 realmente una rese\u00f1a.",
  ],
  "scoreFeedsLine": "Solo las rese\u00f1as escritas reales y la valoraci\u00f3n del mercado alimentan la puntuaci\u00f3n.",
  "independenceLine": "Le\u00edmos las rese\u00f1as de los compradores, agrupamos lo que m\u00e1s repet\u00edan y sopesamos lo bueno frente a lo malo. Somos independientes: no estamos afiliados a ninguna marca ni respaldados por ella.",
  "whyBuyIt": "Por qu\u00e9 lo comprar\u00edas",
  "whyMightNot": "Por qu\u00e9 quiz\u00e1 no",
  "howWeChecked": "C\u00f3mo lo verificamos",
  "footerLine": "An\u00e1lisis de rese\u00f1as escritas reales de compradores y la valoraci\u00f3n del mercado.",
  "complaintNotes": {
    "oneOff": "Ninguna queja se repite entre compradores: son preocupaciones aisladas, mostradas porque importan.",
    "repeated": "Estas preocupaciones aparecieron entre varios compradores.",
    "isolated": "Los compradores plantearon preocupaciones aisladas{about}: cada una se sopesa frente a los elogios de arriba, donde se indica.",
    "none": "No hay quejas de compradores en las rese\u00f1as que le\u00edmos.",
  },
  "answer": {
    "neutralBuy": "Los compradores son mayormente positivos sobre este producto.",
    "neutralSkip": "Los compradores reportan suficientes problemas para omitirlo.",
    "neutralWait": "La opini\u00f3n de los compradores es mixta o a\u00fan limitada.",
    "whyBuyBase": "Los compradores reportan constantemente {love}",
    "whyBuyDefaultLove": "buenos resultados",
    "whyBuyComplaintTail": ", y quejas como {complaint} son raras.",
    "whySkipBase": "Demasiados compradores reportan {complaint}",
    "whySkipDefaultComplaint": "problemas serios",
    "whySkipLoveTail": ", lo que supera {love}.",
    "whyWaitBase": "A los compradores les gusta {love}",
    "whyWaitDefaultLove": "partes de \u00e9l",
    "whyWaitComplaintTail": ", pero los compradores tambi\u00e9n mencionan {complaint}",
    "whyWaitCloser": "Las rese\u00f1as a\u00fan no son lo suficientemente s\u00f3lidas para un {buy} claro.",
    "whyNotEnoughListing": "Poca confianza. A\u00f1ade una captura de rese\u00f1as para leer m\u00e1s rese\u00f1as reales.",
    "whyNotEnoughNoListing": "Poca confianza. Escanea el enlace del anuncio de Amazon o a\u00f1ade una captura de rese\u00f1as para leer m\u00e1s rese\u00f1as reales.",
    "trustBasedOn": "Basado en rese\u00f1as reales de compradores de {sources}.",
    "trustLow": "Poca confianza.",
    "trustUnreadable": "{retry} A\u00f1ade una captura de la p\u00e1gina del producto e intenta el an\u00e1lisis de nuevo.",
    "retryFree": "Reintentarlo es gratis.",
    "retryLater": "Int\u00e9ntalo de nuevo en un momento.",
    "unreadableAmazon": "No pudimos leer esta p\u00e1gina de Amazon en este momento.",
    "unreadableListing": "No pudimos leer esta p\u00e1gina del producto en este momento.",
    "neutralProduct": "Producto de Amazon",
    "evidenceStrength": {"strong": "Fuerte", "moderate": "Moderada", "low": "Baja"},
    "steps": {
      "retry": {"label": "Int\u00e9ntalo de nuevo", "detail": "{unreadable} {retry}"},
      "screenshots": {"label": "A\u00f1adir una captura",
                      "detail": "A\u00f1ade una captura de la p\u00e1gina del producto para que podamos leer el t\u00edtulo, las estrellas y las rese\u00f1as."},
      "amazonListing": {"label": "Escanear el anuncio de Amazon",
                       "detail": "Escanea el enlace del anuncio de Amazon para leer m\u00e1s rese\u00f1as reales de este producto exacto."},
      "reviewScreenshot": {"label": "A\u00f1adir una captura de rese\u00f1as",
                           "detail": "Sube una captura de las rese\u00f1as que ves. Leemos el texto y solo conservamos rese\u00f1as reales de este producto exacto."},
      "compare": {"label": "Comparar con una alternativa",
                  "detail": "Escanea un producto similar y compara lo que dicen los compradores reales."},
    },
  },
}

DE_BRIEF = {
  "shouldYouBuy": "Solltest du es kaufen?",
  "buyingScore": "Kauf-Score",
  "verdict": {
    "buy": "Kaufen", "wait": "Abwarten", "skip": "\u00dcberspringen",
    "lowConfidence": "Geringe Zuversicht", "tryAgain": "Erneut versuchen",
    "leaningBuy": "Eher kaufen", "leaningSkip": "Eher \u00fcberspringen",
  },
  "factTerms": {
    "marketplaceRating": "Marktplatzbewertung",
    "ratingsCounted": "Gez\u00e4hlte Bewertungen",
    "howSureWeAre": "Wie sicher wir sind",
    "valueForMoney": "Preis-Leistung",
    "reviewAuthenticity": "Authentizit\u00e4t der Bewertungen",
  },
  "confidence": {"high": "Hoch", "medium": "Mittel", "low": "Niedrig", "unknown": "Unbekannt"},
  "value": {"good": "Gut", "fair": "Okay", "poor": "Schlecht"},
  "authRows": {
    "low": "Wenige KI-\u00e4hnliche Anzeichen",
    "moderate": "Einige KI-\u00e4hnliche Anzeichen",
    "high": "Starkes KI-\u00e4hnliches Muster",
  },
  "whyBuyIt": "Warum du es kaufen w\u00fcrdest",
  "whyMightNot": "Warum vielleicht nicht",
  "howWeChecked": "Wie wir gepr\u00fcft haben",
}

HI_BRIEF = {
  "verdict": {
    "buy": "\u0916\u0930\u0940\u0926\u0947\u0902", "wait": "\u0930\u0941\u0915\u0947\u0902", "skip": "\u091b\u094b\u0921\u093c\u0947\u0902",
    "lowConfidence": "\u0915\u092e \u0906\u0924\u094d\u092e\u0935\u093f\u0936\u094d\u0935\u093e\u0938",
    "tryAgain": "\u092a\u0941\u0928\u0903 \u092a\u094d\u0930\u092f\u093e\u0938 \u0915\u0930\u0947\u0902",
    "leaningBuy": "\u0916\u0930\u0940\u0926\u0928\u0947 \u0915\u0940 \u0913\u0930",
    "leaningSkip": "\u091b\u094b\u0921\u093c\u0928\u0947 \u0915\u0940 \u0913\u0930",
  },
}

ZH_BRIEF = {
  "verdict": {
    "buy": "\u8d2d\u4e70", "wait": "\u7b49\u7b49", "skip": "\u8df3\u8fc7",
    "lowConfidence": "\u4fe1\u5fc3\u4e0d\u8db3", "tryAgain": "\u91cd\u8bd5",
    "leaningBuy": "\u503e\u5411\u8d2d\u4e70", "leaningSkip": "\u503e\u5411\u8df3\u8fc7",
  },
}

LOCALES = {"en": EN_BRIEF, "fr": FR_BRIEF, "es": ES_BRIEF, "de": DE_BRIEF, "hi": HI_BRIEF, "zh": ZH_BRIEF}

for loc, brief in LOCALES.items():
    path = os.path.join(MSG, f"{loc}.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["Brief"] = brief
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{loc}.json: Brief section written")

# sanity: every non-en leaf path exists in en
def leaves(d, prefix=""):
    out = []
    for k, v in d.items():
        p = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out += leaves(v, p)
        else:
            out.append(p)
    return out

en_leaves = set(leaves(EN_BRIEF))
for loc in ("fr", "es", "de", "hi", "zh"):
    for p in leaves(LOCALES[loc]):
        assert p in en_leaves, f"{loc}: key {p} not in en Brief"
print("all non-en keys exist in en Brief: OK")
