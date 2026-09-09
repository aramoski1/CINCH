export type Protocol = {
  id: string;
  name: string;
  utterance: string;
  why: string;
};

export const PROTOCOLS: Protocol[] = [
  {
    id: "gym-630",
    name: "Gym by 6:30",
    utterance: "Gym by 6:30 tomorrow and stay 45 minutes or I owe my witness $25",
    why: "A place, a dwell, a person. The shape most people can keep.",
  },
  {
    id: "deep-work",
    name: "Deep work",
    utterance: "Two hours of deep work at the library tomorrow, no phone, or I owe $20 to charity",
    why: "Location plus a window. No logging afterwards.",
  },
  {
    id: "off-ig",
    name: "Off Instagram",
    utterance: "Off Instagram until Friday or I lose $50",
    why: "A screen-time window with a partner attest as fallback.",
  },
];
