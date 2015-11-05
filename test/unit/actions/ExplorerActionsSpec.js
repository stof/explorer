var assert = require('chai').assert;
var expect = require('chai').expect;
var sinon = require('sinon');
var moment = require('moment');
var _ = require('lodash');
var Qs = require('qs');
var TestHelpers = require('../../support/TestHelpers');
var AppDispatcher = require('../../../client/js/app/dispatcher/AppDispatcher');
var ExplorerActions = require('../../../client/js/app/actions/ExplorerActions');
var AppStateActions = require('../../../client/js/app/actions/AppStateActions');
var FilterUtils = require('../../../client/js/app/utils/FilterUtils');
var ValidationUtils = require('../../../client/js/app/utils/ValidationUtils');
var ExplorerValidations = require('../../../client/js/app/validations/ExplorerValidations');
var ExplorerUtils = require('../../../client/js/app/utils/ExplorerUtils');
var ExplorerStore = require('../../../client/js/app/stores/ExplorerStore');

describe('actions/ExplorerActions', function() {
  before(function () {
    this.dispatchStub = sinon.stub(AppDispatcher, 'dispatch');
  });

  after(function () {
    AppDispatcher.dispatch.restore();
  });

  beforeEach(function () {
    this.dispatchStub.reset();

  });

  describe('exec', function () {
    before(function () {
      this.client = { run: sinon.spy() };
      this.getStub = sinon.stub(ExplorerStore, 'get');
    });

    after(function () {
      ExplorerStore.get.restore();
    });

    beforeEach(function () {
      this.client.run.reset();
    });

    it('should throw an error if the model is currently loading', function () {
      var explorer = { id: 5, loading: true };
      this.getStub.returns(explorer);
      expect(ExplorerActions.exec.bind(null, this.client, explorer.id)).to.throw("Warning: calling exec when model loading is true. Explorer id: 5");
    });
    it('should call runValidations with the right arguments', function () {
      var explorer = TestHelpers.createExplorerModel();
      this.getStub.returns(explorer);
      var stub = sinon.stub(ValidationUtils, 'runValidations').returns({
        isValid: true
      });
      ExplorerActions.exec(this.client, explorer.id);
      assert.isTrue(stub.calledWith(ExplorerValidations.explorer, explorer));
      ValidationUtils.runValidations.restore();
    });
    it('should call the dispatcher to update the store and set loading to true', function () {
      var explorer = {
        id: 5,
        loading: false,
        query: {}
      };
      this.getStub.returns(explorer);
      sinon.stub(ValidationUtils, 'runValidations').returns({
        isValid: true
      });
      ExplorerActions.exec(this.client, explorer);
      assert.isTrue(this.dispatchStub.calledWith({
        actionType: 'EXPLORER_UPDATE', 
        id: 5,
        updates: { loading: true }
      }));
      ValidationUtils.runValidations.restore();
    });
    it('should add the latest attribute with a limit when the analysis_type is extraction', function () {
      var explorer = {
        id: 5,
        loading: false,
        query: { 
          event_collection: 'click',
          analysis_type: 'extraction'
        }
      };
      this.getStub.returns(explorer);
      sinon.stub(ValidationUtils, 'runValidations').returns({
        isValid: true
      });
      ExplorerActions.exec(this.client, explorer);
      assert.strictEqual(
        this.client.run.getCalls()[0].args[0].params.latest,
        100
      );
      ValidationUtils.runValidations.restore();
    });
  });

  describe('runEmailExtraction', function () {
    before(function () {
      this.runValidationsStub = sinon.stub(ValidationUtils, 'runValidations');
      this.runQueryStub = sinon.stub(ExplorerUtils, 'runQuery');
      this.getStub = sinon.stub(ExplorerStore, 'get');
    });
    after(function () {
      ValidationUtils.runValidations.restore();
      ExplorerUtils.runQuery.restore();
      ExplorerStore.get.restore();
    });

    beforeEach(function () {
      this.runValidationsStub.returns({
        isValid: false,
        lastError: 'The last error'
      });
      this.runValidationsStub.reset();
      this.runQueryStub.reset();
      this.client = { run: sinon.stub() };
      this.explorer = {
        query: {
          analysis_type: 'count',
          event_collection: 'click',
          email: 'contact@keen.io',
          latest: '100'
        }
      };
      this.getStub.returns(this.explorer);
      this.callback = sinon.stub();
    });

    it('should run the standard explorer validation set', function () {
      ExplorerActions.runEmailExtraction(this.client, this.explorer, this.callback);
      assert.isTrue(this.runValidationsStub.calledWith(ExplorerValidations.explorer, this.explorer));
    });
    it('should run the emailExtractionExplorer validation set if the standard validations pass', function () {
      this.runValidationsStub.returns({ isValid: true });
      ExplorerActions.runEmailExtraction(this.client, this.explorer, this.callback);
      assert.isTrue(this.runValidationsStub.calledWith(ExplorerValidations.emailExtractionExplorer, this.explorer));
    });
    it('should NOT run the emailExtractionExplorer validation set if the standard validations fail', function () {
      this.explorer.query.analysis_type = null;
      ExplorerActions.runEmailExtraction(this.client, this.explorer, this.callback);
      assert.isFalse(this.runValidationsStub.calledWith(ExplorerValidations.emailExtractionExplorer, this.explorer));
    });
    it('should NOT run the query if standard validaton fails', function () {
      this.explorer.query.analysis_type = null;
      ExplorerActions.runEmailExtraction(this.client, this.explorer, this.callback);
      assert.isFalse(this.runQueryStub.called);
    });
    it('should NOT run the query if emailExtraction validaton fails', function () {
      this.explorer.query.email = null;
      ExplorerActions.runEmailExtraction(this.client, this.explorer, this.callback);
      assert.isFalse(this.runQueryStub.called);
    });
  });

  describe('fetchAllPersisted', function () {
    beforeEach(function () {
      this.models = [
        {
          id: '1',
          name: 'favorite 1',
          query: {
            event_collection: 'clicks',
            analysis_type: 'count',
            time: {
              relativity: 'this',
              amount: 1,
              sub_timeframe: 'weeks'
            }
          },
          refresh_rate: 0,
          metadata: {
            visualization: {
              chart_type: 'metric'
            }
          }
        },
        {
          id: '2',
          name: 'favorite 2',
          refresh_rate: 0,
          query: {
            event_collection: 'clicks',
            analysis_type: 'sum',
            target_property: 'size',
            time: {
              relativity: 'this',
              amount: 1,
              sub_timeframe: 'weeks'
            }
          },
          metadata: {
            visualization: {
              chart_type: 'metric'
            }
          }
        },
        {
          id: '3',
          name: 'favorite 3',
          refresh_rate: 0,
          query: {
            event_collection: 'clicks',
            analysis_type: 'max',
            target_property: 'amount',
            time: {
              relativity: 'this',
              amount: 1,
              sub_timeframe: 'weeks'
            }
          },
          metadata: {
            visualization: {
              chart_type: 'metric'
            }
          }
        }
      ];
      function getFn(id, callback) {
        callback(null, this.models);
      }
      this.persistence = {
        get: getFn.bind(this)
      };
      this.callback = sinon.stub();
    });

    it('should format the params for each model', function () {
      var spy = sinon.spy(ExplorerUtils, 'formatQueryParams');
      ExplorerActions.fetchAllPersisted(this.persistence, this.callback);
      assert.strictEqual(spy.getCalls().length, 3);
      ExplorerUtils.formatQueryParams.restore();
    });
    it('should run validations for each model', function () {
      var spy = sinon.spy(ValidationUtils, 'runValidations');
      ExplorerActions.fetchAllPersisted(this.persistence, this.callback);
      assert.strictEqual(spy.getCalls().length, 3);
      ValidationUtils.runValidations.restore();  
    });
    it('should include invalid models', function () {
      this.models[2].query = {};
      var stub = sinon.stub(ExplorerActions, 'createBatch');
      ExplorerActions.fetchAllPersisted(this.persistence, this.callback);
      assert.strictEqual(stub.getCall(0).args[0].length, 3);
      ExplorerActions.createBatch.restore();  
    });
    it('should log a warning for invalid models', function () {
      this.models[2].query = {};
      var stub = sinon.stub(window.console, 'warn');
      ExplorerActions.fetchAllPersisted(this.persistence, this.callback);
      assert.strictEqual(stub.getCall(0).args[0], 'A persisted explorer model is invalid: ');
      assert.deepPropertyVal(stub.getCall(0).args[1], 'id', '3');
      window.console.warn.restore();
    });
    it('should call update app state when done and set fetchingPersistedExplorers to false', function () {
      var stub = sinon.stub(AppStateActions, 'update');
      ExplorerActions.fetchAllPersisted(this.persistence, this.callback);
      assert.isTrue(stub.calledWith({ fetchingPersistedExplorers: false }));
      AppStateActions.update.restore();
    });
  });

  describe('execError', function () {
    beforeEach(function () {
      var explorer = { id: 5 };
      ExplorerActions.execError(explorer, { message: 'NOPE' });
    });

    it('should call the dispatcher to update with the right argments', function () {
      assert.isTrue(this.dispatchStub.calledWith({
        actionType: 'EXPLORER_UPDATE',
        id: 5, 
        updates: { loading: false }
      }));
    });
    it('should create a notice with the error message', function () {
      assert.isTrue(this.dispatchStub.calledWith({
        actionType: 'NOTICE_CREATE',
        attrs: {
          text: 'NOPE',
          type: 'error'
        }
      }));
    });
  });

  describe('execSuccess', function () {
    beforeEach(function () {
      this.explorer = {
        id: 5,
        query: {
          analysis_type: 'count'
        },
        metadata: {
          visualization: {
            chart_type: null
          }
        }
      };
      this.response = { result: 100 };
      sinon.stub(ExplorerUtils, 'getChartTypeOptions').returns(['metric']);
      sinon.stub(ExplorerUtils, 'resultSupportsChartType').returns(false);
    });
    afterEach(function () {
      ExplorerUtils.getChartTypeOptions.restore();
      ExplorerUtils.resultSupportsChartType.restore();
    });

    it('should call the dispatcher to update with the right arguments', function () {
      var expectedUpdates = _.cloneDeep(this.explorer);
      expectedUpdates.loading = false;
      expectedUpdates.result = 100;
      expectedUpdates.metadata.visualization.chart_type = 'metric';
      
      ExplorerActions.execSuccess(this.explorer, this.response);

      assert.isTrue(this.dispatchStub.calledWith({
        actionType: 'EXPLORER_UPDATE',
        id: 5,
        updates: expectedUpdates
      }));
    });
    it('should clear all notices', function () {
      ExplorerActions.execSuccess(this.explorer, this.response);
      assert.isTrue(this.dispatchStub.calledWith({
        actionType: 'NOTICE_CLEAR_ALL'
      }));
    });
  });

  describe('async functions', function () {
    before(function () {
      this.getStub = sinon.stub(ExplorerStore, 'get')
    });
    after(function () {
      ExplorerStore.get.restore();
    });

    describe('save with unpersisted explorer', function () {
      beforeEach(function () {
        this.persistence = {
          create: function(model, callback) {
            callback(null, _.assign({}, ExplorerUtils.formatQueryParams(ExplorerUtils.toJSON(model)), { query_name: 'abc123' }));
          }
        };
        this.explorer = TestHelpers.createExplorerModel();
        this.explorer.id = 'TEMP-ABC';
        this.explorer.query_name = 'some name';
        this.explorer.query.event_collection = 'clicks';
        this.explorer.query.analysis_type = 'count';
        this.getStub.returns(this.explorer);
        sinon.stub(ExplorerUtils, 'mergeResponseWithExplorer').returns({ testKey: 'some updates' });
      });

      afterEach(function(){
        ExplorerUtils.mergeResponseWithExplorer.restore();
      });

      it('should dispatch an EXPLORER_SAVING event', function () {
        ExplorerActions.save(this.persistence, 'TEMP-ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_SAVING',
          id: 'TEMP-ABC',
          saveType: 'save'
        }));
      });
      it('should dispatch to update the right model with params from mergeResponseWithExplorer if successful', function () {
        ExplorerActions.save(this.persistence, 'TEMP-ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_UPDATE',
          id: 'TEMP-ABC',
          updates: { testKey: 'some updates' }
        }));
      });
      it('should dispatch a fail event if there is a failure', function () {
        var errorResp = { text: 'an error' };
        this.persistence.create = function(model, callback) {
          callback(errorResp);
        };
        ExplorerActions.save(this.persistence, 'TEMP-ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_SAVE_FAIL',
          saveType: 'save',
          id: 'TEMP-ABC',
          errorResp: errorResp,
          query: this.explorer.query
        }));
      });
    });

    describe('save with an already persisted explorer', function () {
      beforeEach(function () {
        this.persistence = {
          update: function(model, callback) {
            callback(null, _.assign({}, ExplorerUtils.formatQueryParams(ExplorerUtils.toJSON(model)), { query_name: 'abc123' }));
          }
        };
        this.explorer = TestHelpers.createExplorerModel();
        this.explorer.id = 'abc123';
        this.explorer.query_name = 'anb123';
        this.explorer.query.event_collection = 'clicks';
        this.explorer.query.analysis_type = 'count';
        this.getStub.returns(this.explorer);
        sinon.stub(ExplorerUtils, 'mergeResponseWithExplorer').returns({ testKey: 'some updates' });
      });

      afterEach(function(){
        ExplorerUtils.mergeResponseWithExplorer.restore();
      });

      it('should dispatch an EXPLORER_SAVING event', function () {
        ExplorerActions.save(this.persistence, 'ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_SAVING',
          id: 'ABC',
          saveType: 'update'
        }));
      });
      it('should dispatch to update the right model with params from mergeResponseWithExplorer if successful', function () {
        ExplorerActions.save(this.persistence, 'ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_UPDATE',
          id: 'ABC',
          updates: { testKey: 'some updates' }
        }));
      });
      it('should dispatch a fail event if there is a failure', function () {
        var errorResp = { text: 'an error' };
        this.persistence.update = function(model, callback) {
          callback(errorResp);
        };
        ExplorerActions.save(this.persistence, 'ABC');
        assert.isTrue(this.dispatchStub.calledWith({
          actionType: 'EXPLORER_SAVE_FAIL',
          saveType: 'update',
          id: 'ABC',
          errorResp: errorResp,
          query: this.explorer.query
        }));
      });
    });

    describe('destroy', function () {
      xit('should dispatch a EXPLORER_DESTROYING message', function () {
        
      });
      xit('should dispatch a EXPLORER_DESTROY_FAIL message if destroy call fails', function () {
        
      });
      xit('should dispatch a EXPLORER_DESTROY_SUCCESS message if destroy call succeeds', function () {
        
      });
      xit('should remove the model if destroy call succeeds', function () {
        
      });
    });
  });
});
