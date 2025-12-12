from abc import ABC, abstractmethod
from algopy import ARC4Contract, gtxn
from algopy.arc4 import abimethod


class INttV1Receiver(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def receive_message(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        """Receive an attested message from the executor.

        Args:
            verify_vaa: The call to Wormhole Core to verify the VAA
        """
        pass
