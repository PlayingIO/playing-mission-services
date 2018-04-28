import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import { helpers as metrics } from 'playing-metric-services';
import { helpers as rules } from 'playing-rule-services';

import UserMissionModel from '../../models/user-mission.model';
import defaultHooks from './user-mission.hooks';
import { walkThroughTasks } from '../../helpers';

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions'
};

export class UserMissionService extends Service {
  constructor (options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup (app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  async create (data, params) {
    data.loop = 0;
    data.status = 'READY';
    data.performers = [{
      user: data.owner,
      lanes: { [data.lane]: 'player' }
    }];
    return super.create(data);
  }

  /**
   * Get a user mission's activity feed
   */
  async activities (id, data, params, original) {
    assert(original, 'User mission not exists.');

    const svcFeeds = this.app.service('feeds');
    return svcFeeds.action('activities').get(`mission:${original.id}`, params);
  }

  /**
   * List pending mission join or role change requests
   */
  async approvals (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, params.user.id)) {
      throw new Error('Only mission owner can list pending requests.');
    }

    // check for pending invitation
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`notification:${original.owner}`, {
      $match: {
        verb: { $in: ['mission.join.request', 'mission.roles.request'] },
        object: `userMission:${original.id}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

  /**
   * Approve mission join or role change request
   */
  async approval (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can approval the request.');
    }

    // check for pending requests
    const svcFeeds = this.app.service('feeds');
    const notification = `notification:${data.user}`;
    const requests = await svcFeeds.action('activities').get(notification, {
      $match: {
        _id: data.requestId
      }
    });
    if (fp.isEmpty(requests.data) || requests.data[0].state !== 'PENDING') {
      throw new Error('No pending request is found for this request id.');
    }

    const request = requests.data[0];
    if (request.verb === 'mission.join.request') {
      const user = helpers.getId(request.actor);
      const roles = request.roles;
      await this.join(original.id, { user, roles }, {}, original);
    }
    if (request.verb === 'mission.roles.request') {
      const user = helpers.getId(request.actor);
      const roles = request.roles;
      await this.roles(original.id, { user, roles }, {}, original);
    }
    const activity = fp.assoc('state', 'ACCEPTED', request);
    await svcFeeds.action('updateActivity').patch(notification, activity);

    return original;
  }

  /**
   * List invitations sent out for a mission
   */
  async invites (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // Only invitations sent out by current user will be listed.
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${params.user.id}`, {
      query: {
        verb: 'mission.invite',
        actor: `user:${params.user.id}`,
        object: `userMission:${original.id}`,
        state: 'PENDING'
      }
    });

    return invitations;
  }

  /**
   * Invite a player to join a mission
   */
  async invite (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only mission owner can send invites.');
    }

    const performer = fp.find(fp.idPropEq('user', data.player), original.performers || []);
    if (performer) {
      throw new Error('Requested player is already a part of the mission.');
    }

    // check for pending invitation sent by current user
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${data.user}`, {
      query: {
        verb: 'mission.invite',
        object: `userMission:${original.id}`,
        invitee: `user:${data.player}`,
        state: 'PENDING'
      }
    });
    if (fp.isNotEmpty(invitations.data)) {
      throw new Error('An invitation is already pending for the requested player.');
    }

    // send mission.invite in notifier
    return original;
  }

  /**
   * Cancel a pending invite sent out by the current user
   */
  async cancelInvite (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // check for pending invitation sent
    const svcFeeds = this.app.service('feeds');
    const invitations = await svcFeeds.action('activities').get(`user:${data.user}`, {
      query: {
        id: data.invite,
        state: 'PENDING'
      }
    });
    if (fp.isEmpty(invitations.data)) {
      throw new Error('No pending invitation is found for this invite id.');
    }
    // cancel from invitor's feed
    const invitation = invitations.data[0];
    return svcFeeds.action('updateActivity').patch(`user:${data.user}`, {
      id: invitation.id,
      state: 'CANCELED'
    });
  }

  /**
   * Join a mission with specified the role and lanes.
   */
  async join (id, data, params, original) {
    assert(original, 'User mission not exists.');
    assert(original.access !== 'PRIVATE', 'The mission is private, cannot join.');

    const performer = fp.find(fp.idPropEq('user', data.user), original.performers || []);
    if (performer) {
      throw new Error('Player is already a part of the mission.');
    }

    // process the join for public mission
    if (original.access === 'PUBLIC') {
      return super.patch(id, {
        $addToSet: {
          performers: {
            user: data.user,
            lanes: data.roles
          }
        }
      }, params);
    } else {
      // send mission.join.request in notifier
      return original;
    }
  }

  /**
   * Leave a mission.
   */
  async leave (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // the owner himself cannot leave
    if (fp.idEquals(original.owner, data.user)) {
      throw new Error('Owner of the mission cannot leave yourself.');
    }
    const performer = fp.find(fp.idPropEq('user', data.user), original.performers || []);
    if (!performer) {
      throw new Error('You are not a performer of this mission.');
    }

    return super.patch(id, {
      $pull: {
        'performers': { user: data.user }
      }
    }, params);
  }

  /**
   * Kick out a performer from the mission.
   */
  async kick (id, data, params, original) {
    assert(original, 'User mission not exists');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can kick a player.');
    }
    // the owner cannot kicked out himself
    if (fp.idEquals(original.owner, data.player)) {
      throw new Error('Owner of the mission cannot kick yourself.');
    }

    const performer = fp.find(fp.idPropEq('user', data.player), original.performers || []);
    if (!performer) {
      throw new Error('Player is not a member of the mission');
    }

    return super.patch(id, {
      $pull: {
        'performers': { user: data.player }
      }
    }, params);
  }

  /**
   * Play a mission. Playing a mission causes its state to change.
   */
  async play (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // whether the user is one of the performers
    const performer = fp.find(fp.idPropEq('user', params.user.id), original.performers || []);
    if (!performer) {
      throw new Error('data.user is not members of this mission, please join the mission first.');
    }

    // get mission activities
    const svcMissions = this.app.service('missions');
    const mission = await svcMissions.get(helpers.getId(original.mission), {
      query: { $select: 'activities.requires,activities.rewards,*' }
    });
    assert(mission && mission.activities, 'Mission activities not exists.');

    // verify and get new tasks, TODO: task lane?
    const tasks = walkThroughTasks(params.user, original.tasks)(mission.activities);
    const task = fp.find(fp.propEq('key', data.trigger), tasks);
    const activity = fp.dotPath(data.trigger, mission.activities);

    // check the state of the corresponding task
    if (!task || !activity || task.name !== activity.name) {
      throw new Error('Requirements not meet, You can not play the trigger yet.');
    }
    if (task.state === 'COMPLETED') {
      throw new Error('Task has already been completed.');
    }
    let state = 'COMPLETED';
    if (activity.loop) {
      const loop = task.loop || 0;
      if (loop >= activity.loop) {
        throw new Error(`Number of times exceeds, task can only performed ${activity.loop} times.`);
      } else {
        state = (loop + 1 >= activity.loop)? 'COMPLETED' : 'ACTIVE';
      }
    }

    // add task to the mission if not exists
    await super.patch(id, {
      $push: { tasks: task }
    }, {
      query: { 'tasks.key': { $ne: task.key } }
    });

    let updateTask = {
      $inc: { 'tasks.$.loop': 1 },
      $set: { 'tasks.$.state': state },
      $addToSet: { 'tasks.$.performers': { user: data.user, scopes: data.scopes } }
    };

    // rate limiting the task
    if (activity.rate && activity.rate.frequency) {
      let { count, firstRequest, lastRequest, expiredAt } = rules.checkRateLimit(activity.rate, task.limit || {});
      updateTask.$inc['tasks.$.limit.count'] = count;
      updateTask.$set['tasks.$.limit.firstRequest'] = firstRequest;
      updateTask.$set['tasks.$.limit.lastRequest'] = lastRequest;
      updateTask.$set['tasks.$.limit.expiredAt'] = expiredAt;
    }

    // update task state and performers
    const userMission = await super.patch(id, updateTask, {
      query: { 'tasks.key': task.key }
    });
    userMission.currentTask = task;

    // create reward for this task
    userMission.currentRewards = await metrics.createUserMetrics(this.app, data.user, task.rewards || []);

    return userMission;
  }

  /**
   * Change own roles or roles of a performer in mission.
   */
  async roles (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission for other player
    if (data.player && !fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can change roles of a player.');
    }

    // whether the user is one of the performers
    const playerId = data.player || data.user; // player or current user
    const performer = fp.find(fp.idPropEq('user', playerId), original.performers || []);
    if (!performer) {
      throw new Error('Player is not members of this mission, please join the mission first.');
    }

    // process the change if owner or it's a public mission
    if (fp.idEquals(original.owner, data.user) || original.access === 'PUBLIC') {
      // remove a performer from the lane
      params.query = fp.assign(params.query, {
        'performers.user': playerId
      });
      const updates = fp.reduce((acc, lane) => {
        if (data.roles[lane] !== 'false') {
          acc[`performers.$.lanes.${lane}`] = data.roles[lane];
        } else {
          acc['$unset'] = acc['$unset'] || [];
          acc['$unset'].push({ [`performers.$.lanes.${lane}`]: '' });
        }
        return acc;
      }, {}, fp.keys(data.roles));
      return super.patch(id, updates, params);
    } else {
      // send mission.role in notifier
      return original;
    }
  }

  /**
   * Transfer mission ownership to existing performer or any other player
   */
  async transfer (id, data, params, original) {
    assert(original, 'User mission not exists.');

    // must be owner of the mission
    if (!fp.idEquals(original.owner, data.user)) {
      throw new Error('Only owner of the mission can transfer ownership.');
    }
    if (fp.idEquals(original.owner, data.player)) {
      throw new Error('Already owner of the mission.');
    }
    const performer = fp.find(fp.idPropEq('user', data.player), original.performers || []);

    if (performer) {
      params.query = fp.assign(params.query, {
        'performers.user': data.player
      });
      const updates = fp.reduce((acc, lane) => {
        return fp.assoc(`performers.$.lanes.${lane}`, data.roles[lane]);
      }, {}, fp.keys(data.roles));
      updates.owner = data.player;
      return super.patch(id, updates, params);
    } else {
      return super.patch(id, {
        owner: data.player,
        $addToSet: {
          performers: {
            user: data.player,
            lanes: data.roles
          }
        }
      }, params);
    }
  }
}

export default function init (app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
