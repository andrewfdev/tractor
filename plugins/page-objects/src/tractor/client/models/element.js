// Module:
import { PageObjectsModule } from '../page-objects.module';

// Dependencies:
import camelcase from 'camel-case';
import { ELEMENT_ACTIONS } from './meta/element-actions';

function createElementModelConstructor (
    astCreatorService,
    ActionMetaModel
) {
    return class ElementModel {
        constructor (pageObject) {
            this.pageObject = pageObject;

            this.group = false;
            this.name = '';
            this.selector = '';

            this._type = null;
            this.removeType();
        }

        get ast () {
            return this.isUnparseable || this._toAST();
        }

        get meta () {
            return this.name ? this._toMeta() : null;
        }

        get variableName () {
            return camelcase(this.name);
        }

        get type () {
            return this._type;
        }

        set type (newType) {
            this._type = newType;
            if (this.type) {
                this.actions = this.type.actions;
            } else {
                this.actions = ELEMENT_ACTIONS.map(action => new ActionMetaModel(action));
            }
        }

        addType () {
            [this.type] = this.pageObject.availablePageObjects;
        }

        removeType () {
            this.type = null;
        }

        _toAST () {
            let ast = astCreatorService;
            let element = ast.identifier(this.variableName);
            let selector = ast.literal(this.selector);
            let type = null;

            let template;
            if (this.type) {
                type = ast.identifier(this.type.variableName);

                if (this.group) {
                    template = `
                        this.<%= element %> = function (groupSelector) {
                            return new <%= type %>(findAll(by.css(<%= selector %>)).getFromGroup(groupSelector));
                        };
                    `;
                } else {
                    template = `
                        this.<%= element %> = new <%= type %>(find(by.css(<%= selector %>)));
                    `;
                }
            } else {
                if (this.group) {
                    template = `
                        this.<%= element %> = function (groupSelector) {
                            return findAll(by.css(<%= selector %>)).getFromGroup(groupSelector);
                        };
                    `;
                } else {
                    template = `
                        this.<%= element %> = find(by.css(<%= selector %>));
                    `;
                }
            }
            return ast.expression(template, { element, selector, type });
        }

        _toMeta () {
            const meta = { name: this.name };
            if (this.group) {
                meta.group = this.group;
            }
            if (this.type) {
                meta.type = this.type.name;
            }
            return meta;
        }
    };
}

PageObjectsModule.factory('ElementModel', createElementModelConstructor);
