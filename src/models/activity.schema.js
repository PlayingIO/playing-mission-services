import { models as rules } from 'playing-rule-services';

import { notify } from './notify.schema';

// activity structure
const activity = {
  _id: false,
  name: { type: String, required: true },  // name for the activity
  description: { type: String },           // brief description of the activity
  type: { type: String, enum: [            // type of the activity
    'single', 'sequential', 'parallel', 'exclusive'
  ]},
  lane: { type: String },                  // lane in which the activity belongs to
  loop: { type: Number },                  // number of times a player can perform this task
  activities: { type: Array, default: undefined }, // nested activity structure
  rewards: rules.rewards.schema,           // rewards which the player can earn upon completing this task
  requires: rules.requires.schema,         // requirements for performing the task
  notify: notify,                          // notify selected player(s) members when complete task is completed!
  rate: rules.rate.schema,                 // rate limit of the activity
  retry: { type: Boolean, default: false } // whether the player can retry a task if he fails
};

export { activity };