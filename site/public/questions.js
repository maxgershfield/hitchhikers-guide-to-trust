// The Over to You questions: one list, used by the talk's slide, the /over-to-you page and the /record page.
// Edit them here. The first is the one the talk opens with. Keep each one short enough to read across a table.
window.OVER_TO_YOU = [
  {group: 'The future', q: [
    'Who gets to shape what comes next, and who is missing from that room?',
    'Where do you see more people gaining agency, and where do you see power concentrating?',
    'What could AI help you do that you would still want a person to decide?',
    'What are your thoughts on data centers and public compute: who should own them, and who should they serve?'
  ]},
  {group: 'Trust', q: [
    'What does trust in the future look like to you?',
    'When a system makes a decision about you, who answers for it?',
    'What would you want to be able to check for yourself?',
    'Who do you trust to decide for your community, and how could you take that back?'
  ]},
  {group: 'Your community', q: [
    "Who holds your community's keys, and who could recover them?",
    "What would your community's first trust task be?",
    "What's missing for a grassroots community to run this on its own, without us?"
  ]},
  {group: 'Tonight', q: [
    'When have you felt like a hitchhiker?',
    'What did you hear tonight that you want to remember?',
    'What is one promise you could make tonight, and show you kept by next month?'
  ]}
];
window.OVER_TO_YOU_ALL = window.OVER_TO_YOU.flatMap(g => g.q);
