// The Over to You question: used by the talk's slide, the /over-to-you/ page and the /record/ page. Edit it here.
// One question is the plan. The pages can take more: add them to the list and "Another question" comes back.
window.OVER_TO_YOU = [
  {group: 'The question', q: [
    'What does trust mean to you?'
  ]}
];
window.OVER_TO_YOU_ALL = window.OVER_TO_YOU.flatMap(g => g.q);
