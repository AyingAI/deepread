import { Book } from './types';

export const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    coverColor: '#8B4513',
    progress: 45,
    sedimentLevel: 12
  },
  {
    id: '2',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    coverColor: '#2F4F4F',
    progress: 100,
    sedimentLevel: 80
  },
  {
    id: '3',
    title: 'Zen and the Art of Motorcycle Maintenance',
    author: 'Robert Pirsig',
    coverColor: '#556B2F',
    progress: 12,
    sedimentLevel: 4
  }
];

export const MOCK_TEXT_CONTENT = `
  <p>Two of the most important characteristics of good design are discoverability and understanding.</p>
  <p>Discoverability: Is it possible to even figure out what actions are possible and where and how to perform them? Understanding: What does it all mean? How is the camera supposed to be used? What do all the different controls do?</p>
  <p>The complexity of modern devices is undeniable. But complexity is not the problem; confusion is. We can handle complexity if we understand it. When things make sense, we can master them.</p>
  <p>Human-centered design (HCD) is an approach that puts human needs, capabilities, and behavior first, then designs to accommodate those needs, capabilities, and ways of behaving.</p>
  <p>It helps to distinguish between the conceptual model of the designer, which is the designer's mental model of the system, and the system image, which results from the physical structure that has been built (including documentation, instructions, and labels). The user's mental model is developed through interaction with the system and the system image.</p>
  <p>When the system image is incoherent or inappropriate, the user cannot easily use the device. If the user's mental model is wrong, they will struggle.</p>
  <p>This is why the "Active Desk" metaphor is so powerful. It doesn't just show you a list of files; it shows you the state of your mind. The books you are currently wrestling with are open, chaotic, alive. The books you have finished are stacked, settled, providing a foundation for new thoughts.</p>
  <p>Deep reading is not about speed. It is about the quality of the sediment you leave behind. Every note, every highlight, every connection you make adds to the thickness of the book in your mind, even if the digital file size remains the same.</p>
  <p>So, take your time. Drag these words. Make them yours.</p>
`;
