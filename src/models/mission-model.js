import timestamps from 'mongoose-timestamp';
import { plugins } from 'mostly-feathers-mongoose';
import { models as contents } from 'playing-content-services';
import { models as rules } from 'playing-rule-services';
import { models as actions } from 'playing-action-services';

const settings = {
  maxMissions: { type: Number },           // maximun number of instances can be created
  maxActive: { type: Number },             // maximun number of active instances can be created
  maxPlayerMissions: { type: Number },     // maximun number of instances can be created by a player
  maxPlayerActive: { type: Number },       // maximun number of active instances can be created by a player
  requires: rules.rule.requires,           // creation requirements
};

const lane = {
  name: { type: String },                  // name for the lane
  default: { type: Boolean },              // automatically join this lane when join the instance
};

const notification = {
  mail: {                                  // notification email when task is completed
    subject: { type: String },
    message: { type: String }
  },
  message: { type: String },               // in-app notification message
  target: {                                // notification target
    type: { type: String, enum: [          // target type
      'self', 'team_mates', 'process_members', 'all'
    ]},
    requires: rules.rule.requires,         // target requirements
    roles: [{                              // target roles
      lane: { type: String },
      role: { type: String }
    }]
  }
};

// activity structure
const activity = {
  name: { type: String, required: true },  // name for the activity
  type: { type: String, enum: [            // type of the activity
    'task', 'submission'
  ]},
  lane: { type: String },                  // lane in which the activity belongs to
  loop: { type: Number },                  // number of times a player can perform this task
  activities: { type: Array, default: undefined }, // nested submission structure
  rewards: rules.rule.rewards,             // rewards which the player can earn upon completing this task
  requires: rules.rule.requires,           // requirements for performing the task
  notification: notification,              // notify selected player(s) members when complete task is completed!
  rate: actions.action.rate,               // rate limit of the activity
};

// gateway structure
const gateway = {
  name: { type: String, required: true },  // name for the gateway
  type: { type: String, enum: [            // type of the gateway
    'parallel', 'exclusive'
  ]},
  lane: { type: String },                  // lane in which the activity belongs to
};

// Sequence flows structure
const sequenceflow = {
  from: { type: String, required: true },  // node from which the sequence flow originates
  to: { type: String, required: true },    // node to which the sequence flow originates
  retry: { type: Boolean },                // whether the player can retry a task if he fails
  lane: { type: String },                  // lane in which the activity belongs to
};

/*
 * Definition of the mission to structure the player activities
 */
const fields = {
  name: { type: String, required: true },  // name for the mission
  description: { type: String },           // brief description of the mission
  image: contents.blob.schema,             // image which represents the mission
  access: [{ type: String, enum: [         // access settings with which the mission instance can be created
    'public', 'protected', 'private'
  ]}],
  settings: settings,                      // settings for the whole mission
  lanes: [lane],                           // lanes for retricting players
  activities: [activity],                  // tasks or sub-missions within a mission
  gateways: [gateway],                     // gateway for retricting the access to tasks and sub-mission based on the mission state
  sequenceflows: [sequenceflow],           // lightweight objects which connect other nodes (activities, gateways) to each other
  tags: [{ type: String }],                // tags of the mission
};

export default function model (app, name) {
  const mongoose = app.get('mongoose');
  const schema = new mongoose.Schema(fields);
  schema.plugin(timestamps);
  schema.plugin(plugins.softDelete);
  return mongoose.model(name, schema);
}

model.schema = fields;