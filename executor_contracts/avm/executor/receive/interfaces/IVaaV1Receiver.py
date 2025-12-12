from abc import ABC, abstractmethod
from algopy import ARC4Contract, gtxn
from algopy.arc4 import abimethod


class IVaaV1Receiver(ARC4Contract, ABC):
    @abstractmethod
    @abimethod
    def execute_vaa_v1(self, verify_vaa: gtxn.ApplicationCallTransaction) -> None:
        """Receive an attested message from the executor.

        Args:
            verify_vaa: The call to Wormhole Core to verify the VAA
        """
        pass
