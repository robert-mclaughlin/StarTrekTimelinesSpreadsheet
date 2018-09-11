import React from 'react';
import { Dialog, DialogType, DialogFooter } from 'office-ui-fabric-react/lib/Dialog';
import { PrimaryButton, DefaultButton } from 'office-ui-fabric-react/lib/Button';

import STTApi from 'sttapi';
import { CONFIG, replicatorCurrencyCost, replicatorFuelCost, canReplicate, replicatorFuelValue, canUseAsFuel, replicate } from 'sttapi';

export class ReplicatorDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            showDialog: false,
            enoughFuel: false,
            targetArchetype: undefined
        };

        this._closeDialog = this._closeDialog.bind(this);
        this.show = this.show.bind(this);
    }

    show(targetArchetype) {
        let currencyCost = replicatorCurrencyCost(targetArchetype.id, targetArchetype.rarity);
        let fuelCost = replicatorFuelCost(targetArchetype.type, targetArchetype.rarity);
        let canBeReplicated = canReplicate(targetArchetype.id);

        this.setState({
            showDialog: true,
            enoughFuel: false,
            currencyCost,
            fuelCost,
            canBeReplicated,
            targetArchetype
        });
    }

    _closeDialog() {
        this.setState({
            showDialog: false,
            enoughFuel: false,
            targetArchetype: undefined
        });
    }

    render() {
        if (!this.state.showDialog) {
            return <span />;
        }

        return <Dialog
            hidden={!this.state.showDialog}
            onDismiss={this._closeDialog}
            dialogContentProps={{
                type: DialogType.normal,
                containerClassName: 'replicatordialogMainOverride',
                title: `Replicate one ${CONFIG.RARITIES[this.state.targetArchetype.rarity].name} ${this.state.targetArchetype.name}`
            }}
            modalProps={{
                isBlocking: true
            }}
        >
            <p>NOT IMPLEMENTED YET! I'm working on it...</p>

            {!this.state.canBeReplicated && <p>This item cannot be replicated!</p>}

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gridTemplateAreas: `'fuelconfig fueltank' 'fuellist fueltank' 'fuellist details'` }}>
                <div style={{ gridArea: 'fuelconfig' }}>Config here</div>
                <div style={{ gridArea: 'fuellist' }}>List of fuel here</div>
                <div style={{ gridArea: 'fueltank' }}>
                    <p>Tank of fuel to burn here</p>
                    <p>Fuel needed: {this.state.fuelCost}</p>
                </div>
                <div style={{ gridArea: 'details' }}>
                    <p>Cost: {this.state.currencyCost} credits</p>
                </div>
            </div>

            <DialogFooter>
                <PrimaryButton onClick={this._closeDialog} text='Replicate' disabled={this.state.canBeReplicated && !this.state.enoughFuel} />
                <DefaultButton onClick={this._closeDialog} text='Cancel' />
            </DialogFooter>
        </Dialog>;
    }
}