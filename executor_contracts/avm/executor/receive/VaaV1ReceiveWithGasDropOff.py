from algopy import OnCompleteAction, gtxn, op
from algopy.arc4 import Bool, DynamicBytes, abimethod, arc4_signature,emit

from ...types import Bytes32
from .interfaces.IVaaV1Receiver import IVaaV1Receiver
from .interfaces.IVaaV1ReceiveWithGasDropOff import IVaaV1ReceiveWithGasDropOff, VAAMessageReceived


class VaaV1ReceiveWithGasDropOff(IVaaV1ReceiveWithGasDropOff):
    @abimethod
    def receive_message(
        self,
        gas: gtxn.PaymentTransaction,
        verify_sigs: gtxn.ApplicationCallTransaction,
        verify_vaa: gtxn.ApplicationCallTransaction,
        execute_vaa: gtxn.ApplicationCallTransaction,
        gas_drop_off: gtxn.PaymentTransaction,
        request_for_execution_id: Bytes32
    ) -> None:
        # check the gas instruction sends ALGO to contract
        contract_address, exists = op.AppParamsGet.app_address(execute_vaa.app_id)
        assert exists, "Contract address unknown"
        assert gas.receiver == contract_address, "Gas receiver unknown"

        # verify_sigs implicitly required from verify_vaa call
        # the contract checks the verify_vaa call so not done here to avoid redundancy

        # check the execute_vaa call
        assert execute_vaa.on_completion == OnCompleteAction.NoOp, "Incorrect app on completion"
        assert execute_vaa.app_args(0) == arc4_signature(IVaaV1Receiver.execute_vaa_v1), "Incorrect method"

        # gas drop off can be arbitrary so not checked

        emit(VAAMessageReceived(request_for_execution_id, Bool(True), DynamicBytes(b"")))

    @abimethod
    def report_error(self, request_for_execution_id: Bytes32, error_reason: DynamicBytes) -> None:
        emit(VAAMessageReceived(request_for_execution_id, Bool(False), error_reason))
