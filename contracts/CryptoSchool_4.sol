// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract CryptoSchool_4 {
    address public owner;
    mapping(address => uint256) public payments;
    bytes32 internal constant _UNDERLYING_SLOT = 0x1994607607e11d53306ef62e45e3bd85762c58d9bf38b5578bc4a258a26a7371;

    constructor() {
        owner = msg.sender;
    }

    function depos() public payable {
        payments[msg.sender] = msg.value;
    }

    function MoneyBack() public {
        address payable _to = payable(owner);
        address _thisContract = address(this);
        _to.transfer(_thisContract.balance);
    }

    receive() external payable {}
}
