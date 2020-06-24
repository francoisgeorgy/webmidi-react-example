import {decorate, observable} from "mobx";

type PortListener = (message: WebMidi.MIDIMessageEvent) => void;

export interface Port {
    id: string;
    name: string;
    connection: WebMidi.MIDIPortConnectionState;
}

export interface Ports {
    [id: string]: Port
}

export type OutMessage = number[];

type InterfaceSubscriber = (info: any) => void;

// Channel Voice Messages
export const MIDI_VOICE_NOTE_ON = 0x90;
export const MIDI_VOICE_NOTE_OFF = 0x80;
export const MIDI_VOICE_POLYPHONIC_KEY_PRESSURE = 0xA0;
export const MIDI_VOICE_CONTROL_CHANGE = 0xB0;
export const MIDI_VOICE_PROGRAM_CHANGE = 0xC0;
export const MIDI_VOICE_CHANNEL_PRESSURE = 0xD0;
export const MIDI_VOICE_PITCH_BEND_CHANGE = 0xE0;

class MidiStore {

    interface : any = null;
    inputs: Ports = {};
    outputs: Ports = {};
    inputInUseId = "";
    outputInUseId = "";
    // inputInUse: WebMidi.MIDIInput = undefined;       // todo: really used?
    outputInUse: WebMidi.MIDIOutput | undefined;
    listeners: PortListener[] = [];

    constructor() {
        this.onStateChange = this.onStateChange.bind(this);     // very important
        this.onMidiMessage = this.onMidiMessage.bind(this);     // very important
        this.requestMidi(); //.then(r => console.log(r));
    }

/*
    autoSelect(name: RegExp) {

        //TODO: unselect if null?

        if (!name) return null;

        if (!this.inputInUseId) {
            for (let port of this.interface.inputs.values()) {
                if (port.name.match(name)) {
                    // console.log(`autoSelect input ${port.name} ${port.id}`);
                    this.useInput(port.id);
                    break;
                }
            }
        }

        if (!this.outputInUseId) {
            for (let port of this.interface.outputs.values()) {
                if (port.name.match(name)) {
                    // console.log(`autoSelect output ${port.name} ${port.id}`);
                    this.useOutput(port.id);
                    break;
                }
            }
        }
    }
*/

    inputById(id: string): WebMidi.MIDIInput | null {
        if (!id) return null;
        for (let port of this.interface.inputs.values()) {
            if (port.id === id) {
                return port;
            }
        }
        return null;
    }

    outputById(id: string): WebMidi.MIDIOutput | null {
        if (!id) return null;
        for (let port of this.interface.outputs.values()) {
            if (port.id === id) {
                return port;
            }
        }
        return null;
    }

    send(messages: OutMessage) {
        if (!this.outputInUse) return;
        this.outputInUse.send(messages);
    }

    sendCC(controller: number, value: number, channel: number): void {
        if (!this.outputInUse) return;
        //TODO: validate parameters
        this.outputInUse.send([MIDI_VOICE_CONTROL_CHANGE + channel, controller, value]);
    }

    // channel is 0..15
    sendNRPN(MSB: number, LSB: number, value: number, channel: number): void {
        //TODO: validate parameters
        // 1. select the NRPN
        this.sendCC(99, MSB, channel);
        this.sendCC(98, LSB, channel);
        // 2. set the NRPN value:
        this.sendCC( 6, 0, channel);        //TODO: get value MSB
        this.sendCC(38, value, channel);    //TODO: get value LSB
        // 3. si is recommended that the Null Function (RPN 7F,7F) should be sent immediately after a RPN or NRPN and its value are sent.
        this.sendCC(101, 127, channel);
        this.sendCC(100, 127, channel);
    }

    connectInput(id: string) {
        for (let input of this.interface.inputs.values()) {
            if (input.id === id) {
                // console.log("MidiStore.connectInput", id);  //, input.onmidimessage);
                // this.inputInUse = input;
                if (!input.onmidimessage) {
                    input.onmidimessage = this.onMidiMessage;
                } else {
                    // console.log("MidiStore.connectInput: already connected", id);
                }
            }
        }
        // console.log("connect", id, this.inputs[id].onmidimessage);
        // if (this.inputs[id].) {)
    }

    // use this method when you need to more than one listener
    addListener(callback: PortListener) {
        // console.log("MidiStore.addListener");
        // this.connect(id);
        this.listeners.push(callback);
        // console.log("addListener listeners:", this.inputs[id].listeners);
    }

    useInput(id: string) {
        // console.log("MidiStore.useInput", id);
        this.inputInUseId = id;
        this.connectInput(id);
    }

    useOutput(id: string, callback: any = null) {
        // console.log("MidiStore.useOutput", id);
        this.outputInUseId = id;
        for (let port of this.interface.outputs.values()) {
            if (port.id === id) {
                this.outputInUse = port;
            }
        }
        // if (this.outputs.hasOwnProperty(id)) {
        //     if (exclusive) {
        //         //TODO: remove all others inUse inputs
        //     }
        //     this.outputs[id].inUse = true;
        // }
    }

    updateInputsOutputs() {

        // console.log("MidiStore.updateInputsOutputs", Object.keys(this.inputs));

        if (!this.interface) return;

        //
        // INPUTS
        //

        // Check for inputs to remove
        for (let id of Object.keys(this.inputs)) {  // our array of inputs
            let remove = true;
            for (let input of this.interface.inputs.values()) {    // midi interface list of inputs
                if (input.id === id) {
                    remove = false;
                    break;
                }
            }
            if (remove) {
                // console.warn("remove", id);

                //TODO: remove listeners

                delete(this.inputs[id]);
            }
        }

        // Inputs to add
        for (let input of this.interface.inputs.values()) {
            if (this.inputs.hasOwnProperty(input.id)) {
                // update
                this.inputs[input.id].connection = input.connection;
                continue;
            }
            this.inputs[input.id] = {
                id: input.id,
                name: input.name,
                connection: input.connection
            };
        }

        //
        // OUTPUTS
        //
        for (let id of Object.keys(this.outputs)) {  // our array of outputs
            let remove = true;
            for (let output of this.interface.outputs.values()) {    // midi interface list of outputs
                // console.log("check", id, output.id, output.type, output.name, output.state, output.connection);
                if (output.id === id) {
                    remove = false;
                    break;
                }
            }
            if (remove) {
                delete(this.outputs[id]);
            }
        }

        // outputs to add
        for (let output of this.interface.outputs.values()) {
            if (this.outputs.hasOwnProperty(output.id)) {
                // output already added
                continue;
            }
            this.outputs[output.id] = {
                id: output.id,
                name: output.name,
                connection: output.connection
            };
        }

    }

    onMidiMessage(message: WebMidi.MIDIMessageEvent) {
        for (let listener of this.listeners) {
            // console.log("call listener for port ", id);
            listener(message);
        }
    }

    onStateChange(event: WebMidi.MIDIConnectionEvent) {
        this.updateInputsOutputs();
    }

    async requestMidi() {
        if (navigator.requestMIDIAccess) {
            try {
                const o = await navigator.requestMIDIAccess({sysex: true});
                this.onMIDISuccess(o);
            } catch (e) {
                console.warn("requestMIDIAccess denied", e);
            }
        } else {
            console.warn("ERROR: navigator.requestMIDIAccess not supported", "#state");
        }
    }

    onMIDISuccess(midiAccess: WebMidi.MIDIAccess) {
        this.interface = midiAccess;
        this.updateInputsOutputs();
        this.interface.onstatechange = this.onStateChange;
    }

    onMIDIFailure(msg: any) {
        // console.log("onMIDIFailure" + msg);
    }

}

decorate(MidiStore, {
    interface: observable,
    inputs: observable,
    outputs: observable,
    inputInUseId: observable,
    outputInUseId: observable
});

export default new MidiStore();
