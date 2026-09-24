import { dayOfYear } from './dates';

export const QUOTES: Array<{ text: string; author: string }> = [
  { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant' },
  { text: 'The successful warrior is the average person, with laser-like focus.', author: 'Bruce Lee' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Ease is a greater threat to progress than hardship.', author: 'Denzel Washington' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'Little by little, one travels far.', author: 'J.R.R. Tolkien' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { text: 'Don’t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
  { text: 'Perfection is not attainable, but if we chase perfection we can catch excellence.', author: 'Vince Lombardi' },
  { text: 'The body achieves what the mind believes.', author: 'Napoleon Hill' },
  { text: 'Arise, awake, and stop not till the goal is reached.', author: 'Swami Vivekananda' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Fall seven times and stand up eight.', author: 'Japanese proverb' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'The pain of discipline weighs ounces; the pain of regret weighs tons.', author: 'Jim Rohn' },
  { text: 'Champions keep playing until they get it right.', author: 'Billie Jean King' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington' },
  { text: 'No one has ever become poor by giving.', author: 'Anne Frank' },
  { text: 'The best way to find yourself is to lose yourself in the service of others.', author: 'Mahatma Gandhi' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  { text: 'Kindness is a language which the deaf can hear and the blind can see.', author: 'Mark Twain' },
  { text: 'Nothing will work unless you do.', author: 'Maya Angelou' },
  { text: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey' },
  { text: 'We generate fears while we sit. We overcome them by action.', author: 'Henry Link' },
  { text: 'Where focus goes, energy flows.', author: 'Tony Robbins' },
  { text: 'The mind is everything. What you think you become.', author: 'Buddha' },
  { text: 'Believe you can and you’re halfway there.', author: 'Theodore Roosevelt' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Knowing yourself is the beginning of all wisdom.', author: 'Aristotle' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'He who has a why can bear any how.', author: 'Friedrich Nietzsche' },
  { text: 'Consistency is what transforms average into excellence.', author: 'Tony Robbins' },
];

/** Deterministic daily quote: stable across reloads, no network. */
export function quoteFor(date: string): { text: string; author: string } {
  return QUOTES[dayOfYear(date) % QUOTES.length];
}
