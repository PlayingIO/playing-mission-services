import assert from 'assert';
import makeDebug from 'debug';
import { Service, helpers, createService } from 'mostly-feathers-mongoose';
import fp from 'mostly-func';
import UserMissionModel from '~/models/user-mission-model';
import defaultHooks from './user-mission-hooks';

const debug = makeDebug('playing:mission-services:user-missions');

const defaultOptions = {
  name: 'user-missions'
};

class UserMissionService extends Service {
  constructor(options) {
    options = Object.assign({}, defaultOptions, options);
    super(options);
  }

  setup(app) {
    super.setup(app);
    this.hooks(defaultHooks(this.options));
  }

  create(data, params) {
    assert(data.mission, 'data.mission not provided.');
    assert(data.access, 'data.access not provided.');
    assert(data.owner, 'data.owner not provided.');
    assert(params.user, 'params.user not provided');

    const svcMissions = this.app.service('missions');
    const getMission = (id) => svcMissions.get(id);

    return getMission(data.mission).then(mission => {
      assert(mission, 'data.mission is not exists.');
      data['$inc'] = { loop: 0 };
      data.status = 'ready';
      const defaultLane = fp.find(fp.propEq('default', true), mission.lanes || []);
      if (defaultLane) {
        data.performers = [{
          user: data.owner,
          lanes: [{ lane: defaultLane.name, role: 'player' }]
        }];
      }
      return super._upsert(null, data, { query: {
        mission: data.mission,
        owner: data.owner
      }});
    });
  }

  _join(id, data, params, orignal) {
    assert(orignal && orignal.performers, 'target performers not exists');
    assert(data.lane, 'data.lane is not provided.');
    assert(data.role, 'data.role is not provided.');

    const getMission = (id) => this.app.service('missions').get(id);
    const getPerformer = (id) => id? this.app.service('users').get(id) : Promise.resolve();

    return Promise.all([
      getMission(orignal.mission),
      getPerformer(data.performer)
    ]).then(([mission, performerUser]) => {
      assert(mission, 'mission not exists');
      if (data.performer) assert(performerUser, 'performer not exists');

      const performerId = data.performer || data.user;
      const performer = fp.find(p => String(p.user) === performerId, orignal.performers);
      const lanes = fp.map(fp.prop('name'), mission.lanes || []);
      assert(fp.contains(data.lane, lanes), 'data.lane not exists in current mission');

      if (performer) {
        params.query = fp.assign(params.query, {
          'performers.user': performerId
        });
        return super.patch(id, {
          $addToSet: {
            'performers.$.lanes': { role: data.role, lane: data.lane }
          }
        }, params);
      } else {
        return super.patch(id, {
          $addToSet: {
            performers: {
              user: performerId,
              lanes: [{ role: data.role, lane: data.lane }]
            }
          }
        }, params);
      }
    });
  }
}

export default function init(app, options, hooks) {
  options = Object.assign({ ModelName: 'user-mission' }, options);
  return createService(app, UserMissionService, UserMissionModel, options);
}

init.Service = UserMissionService;
