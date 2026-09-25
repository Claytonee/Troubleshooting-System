/**
 * The animated explainers we ship with. Feature 15.
 *
 * Each is a SCRIPT, not a video: which part of the drawing to light up, what to
 * say in Kiswahili and English, and how long to hold. The drawing itself is SVG
 * in `frontend/js/components/explainer.js`, keyed by `art`.
 *
 * Rules, learned from the tour work (D27) and from what these schools are like:
 *  - At most seven scenes. An explainer that needs eight is two explainers.
 *  - Kiswahili is written first and is the original; English is written to say
 *    the same thing naturally, never word for word.
 *  - Every scene must change what the reader does or checks next. A scene that
 *    only decorates is deleted — the same test as a dashboard tile (D33).
 *  - Never name a supplier, a price, or tell anybody to buy something.
 */

const EXPLAINER_SEED = [
  {
    key: 'lrs-or-internet',
    art: 'network',
    category: 'Connectivity',
    equipment: 'lrs',
    sort_order: 10,
    title_sw: 'Intaneti imekatika — je somo linaweza kuendelea?',
    title_en: 'The internet is down — can the lesson still run?',
    // The single most valuable thing a teacher here can know, and the one most
    // of them do not: the LRS and the uplink are two different things, and
    // teaching continues when only the uplink is gone.
    scenes: [
      {
        focus: ['tablet', 'wifi', 'router'],
        ms: 7000,
        sw: 'Tablet yako inaunganishwa na router kupitia WiFi. Kutoka hapo kuna NJIA MBILI tofauti — na ni muhimu kujua zinatofautiana.',
        en: 'Your tablet reaches the router over WiFi. From there the signal takes TWO separate paths — and the difference between them matters.'
      },
      {
        focus: ['router', 'linkLrs', 'lrs'],
        ms: 8000,
        sw: 'Njia ya kwanza inaishia kwenye LRS — seva iliyopo hapa shuleni. Quest Forward yote ipo humo. Njia hii HAIHITAJI intaneti hata kidogo.',
        en: 'The first path ends at the LRS — the server here in the school. All of Quest Forward sits on it. This path needs no internet at all.'
      },
      {
        focus: ['router', 'linkWan', 'cloud'],
        ms: 7000,
        sw: 'Njia ya pili inatoka nje kwenda intaneti. Hii hutumika kwa sync tu — kupeleka kazi za wanafunzi na kupokea masasisho.',
        en: 'The second path goes out to the internet. That one is only used for sync — sending student work up and pulling updates down.'
      },
      {
        focus: ['lrs', 'tablet'],
        ms: 8000,
        sw: 'Kwa hiyo: kama LRS iko hai, SOMO LINAENDELEA. Fungua Quest — kama masomo yanapakia, kila kitu kipo sawa. Intaneti itarudi, kazi zitasync baadaye.',
        en: 'So: if the LRS is alive, THE LESSON CONTINUES. Open Quest — if the content loads, you are fine. The internet will come back and the work will sync later.'
      },
      {
        focus: ['lightPower', 'lightLan', 'lightWan'],
        ms: 9000,
        sw: 'Ili kujua ni upande upi, angalia taa za router. Taa ya umeme na ya LAN zikiwaka lakini ya WAN/Internet imezimika au ni nyekundu — tatizo ni mtandao wa nje, si letu.',
        en: 'To tell which side is at fault, look at the router lights. Power and LAN lit but WAN/Internet off or red means the problem is the ISP, not our equipment.'
      },
      {
        focus: ['lrs'],
        ms: 8000,
        sw: 'Lakini kama Quest haipakii kabisa, tatizo ni LRS — na hapo somo haliwezi kuendelea. Ripoti hili kama CRITICAL, si la kusubiri.',
        en: 'But if Quest will not load at all, the LRS is the problem — and then the lesson cannot run. Report that as CRITICAL, not as something that can wait.'
      }
    ]
  },

  {
    key: 'charging-hub-dead',
    art: 'hub',
    category: 'Hardware',
    equipment: 'charging_hub',
    sort_order: 20,
    title_sw: 'Hub ya kuchaji haiwaki baada ya umeme kukatika',
    title_en: 'The charging hub will not power on after an outage',
    scenes: [
      {
        focus: ['hub', 'ledOff'],
        ms: 6000,
        sw: 'Tablet nyingi kwenye hub moja hazichaji, na taa ya hub imezimika. Mara nyingi si tablet zilizoharibika — ni hub tu.',
        en: 'Several tablets on one hub are not charging and the hub light is off. Usually the tablets are fine — it is the hub.'
      },
      {
        focus: ['wallPlug'],
        ms: 7000,
        sw: 'Hatua ya kwanza: ondoa hub kwenye soketi ya ukutani. Si kuzima swichi tu — itoe kabisa, kisha subiri sekunde 30 kamili.',
        en: 'First: unplug the hub at the wall. Not just the switch — pull it out, then wait a full 30 seconds.'
      },
      {
        focus: ['leadBack'],
        ms: 7000,
        sw: 'Wakati unasubiri, kaza kebo ya umeme nyuma ya hub. Mara nyingi hulegea baada ya umeme kukatika ghafla.',
        en: 'While you wait, reseat the power lead at the back of the hub. It works loose surprisingly often after a sudden outage.'
      },
      {
        focus: ['ledOn'],
        ms: 7000,
        sw: 'Rudisha kwenye soketi na angalia taa. Ikiwaka — hub imerudi, na tablet zitaanza kuchaji ndani ya dakika chache.',
        en: 'Plug it back in and watch the light. If it comes on, the hub has recovered and the tablets will start charging within a few minutes.'
      },
      {
        focus: ['hub', 'spare'],
        ms: 8000,
        sw: 'Ikibaki imezimika, hamisha tablet mbili kwenda hub nyingine na uhakikishe zinachaji. Ikiwa zinachaji, hub ndiyo mbovu — ripoti ikiwa na namba ya hub na idadi ya tablet.',
        en: 'If it stays off, move two tablets to another hub and check they charge. If they do, the hub itself has failed — report it with the hub number and how many tablets are on it.'
      }
    ]
  }
];

module.exports = { EXPLAINER_SEED };
