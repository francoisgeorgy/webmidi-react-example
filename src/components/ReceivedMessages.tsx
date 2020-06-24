import {observer} from "mobx-react";
import {useStores} from "../hooks/useStores";
import {useEffect} from "react";

export const ReceivedMessages = observer(() => {

    const {midiStore: midi} = useStores();

    useEffect(() => {
        midi.addListener(message => {
            console.log("dummy", message)
        });
        return function cleanup() {
            console.log("Dummy: cleanup listener");
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    return (
        <div>
            {ins}
        </div>
    )

});