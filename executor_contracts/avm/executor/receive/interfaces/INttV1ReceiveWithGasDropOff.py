from abc import ABC, abstractmethod
from algopy import ARC4Contract, gtxn
from algopy.arc4 import Bool, DynamicBytes, Struct, abimethod

from ....types import Bytes32


# Events
class NTTMessageReceived(Struct):
    request_for_execution_id: Bytes32
    success: Bool
    error_reason: DynamicBytes


class INttV1ReceiveWithGasDropOff(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def receive_message(
        self,
        gas: gtxn.PaymentTransaction,
        verify_sigs: gtxn.ApplicationCallTransaction,
        verify_vaa: gtxn.ApplicationCallTransaction,
        receive_ntt: gtxn.ApplicationCallTransaction,
        gas_drop_off: gtxn.PaymentTransaction,
        request_for_execution_id: Bytes32
    ) -> None:
        """Receive a message on the contract and do gas drop off if necessary.

        Args:
            gas: The ALGO amount to send to contract.
            verify_sigs: The call to Wormhole Core to verify the guardian signatures.
            verify_vaa: The call to Wormhole Core to verify the VAA.
            receive_ntt: The call to contract to execute a VAA.
            gas_drop_off: The ALGO amount to drop off at recipient.
            request_for_execution_id: The request for execution id.
        """
        pass
